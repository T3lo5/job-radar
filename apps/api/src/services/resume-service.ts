import { prisma } from '../db/prisma.js';
import { saveFile, deleteFile, readFileStream } from './file-storage.js';
import { extractText } from './text-extraction.js';
import { createCvParser } from './ai/factory.js';
import { sensitiveDataDetector } from './sensitive-data-detector.js';

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export class ResumeService {
  async upload(
    file: { filename: string; mimetype: string; toBuffer: () => Promise<Buffer> },
    userId: string,
  ) {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new Error('Invalid file type. Only PDF and DOCX are allowed.');
    }

    const buffer = await file.toBuffer();

    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error('File too large. Maximum size is 10MB.');
    }

    let rawText: string;
    try {
      rawText = await extractText(buffer, file.mimetype);
    } catch (err) {
      // A mensagem de extração já vem pronta para o usuário (ver FALHA_PDF em
      // text-extraction.ts). Embrulhar de novo com prefixo técnico em inglês
      // era o que produzia "Failed to extract text: Invalid number...".
      throw err instanceof Error ? err : new Error(String(err));
    }

    const stored = await saveFile(buffer, file.filename, file.mimetype);

    // Detecta dados sensíveis no texto extraído e persiste para o usuário
    // revisar. A detecção não bloqueia o upload — só alerta. Os achados são
    // armazenados dentro de `parsedJson` (campo Json existente), evitando
    // migration de schema.
    const sensitive = rawText
      ? sensitiveDataDetector.check(rawText)
      : { issues: [], safeToApply: true };
    const parsedJson: any =
      sensitive.issues.length > 0 ? { sensitiveIssues: sensitive.issues } : {};

    // O primeiro CV do usuário vira padrão. Sem isto, o otimizador de CV
    // (que busca `isDefault: true`) nunca encontraria nada, porque o campo
    // nunca era marcado ao fazer upload.
    const existingResume = await prisma.resume.findFirst({
      where: { userId },
      select: { id: true },
    });

    const resume = await prisma.resume.create({
      data: {
        userId,
        filename: stored.filename,
        mimeType: file.mimetype,
        rawText,
        parsedJson,
        isDefault: !existingResume,
      },
    });

    return {
      id: resume.id,
      filename: resume.filename,
      mimeType: resume.mimeType,
      size: stored.size,
      uploadedAt: resume.uploadedAt,
      rawText,
      sensitiveIssues: sensitive.issues,
      isDefault: !existingResume,
    };
  }

  async list(userId: string) {
    const resumes = await prisma.resume.findMany({
      where: { userId },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        isDefault: true,
        uploadedAt: true,
        parsedJson: true,
      },
    });

    return resumes.map((r) => ({
      ...r,
      sensitiveIssues: (r.parsedJson as any)?.sensitiveIssues ?? [],
    }));
  }

  async getById(id: string, userId: string) {
    const resume = await prisma.resume.findFirst({ where: { id, userId } });
    if (!resume) return null;

    return { resume, stream: readFileStream(resume.filename) };
  }

  async getText(id: string, userId: string) {
    return prisma.resume.findFirst({
      where: { id, userId },
      select: { id: true, rawText: true },
    });
  }

  async delete(id: string, userId: string) {
    const resume = await prisma.resume.findFirst({ where: { id, userId } });
    if (!resume) return false;

    await deleteFile(resume.filename);
    await prisma.resume.delete({ where: { id } });

    // Se o deletado era o padrão, o próximo mais recente assume o cargo.
    if (resume.isDefault) {
      const next = await prisma.resume.findFirst({
        where: { userId: resume.userId },
        orderBy: { uploadedAt: 'desc' },
      });
      if (next) {
        await prisma.resume.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }

    return true;
  }

  async extract(id: string, userId: string) {
    const resume = await prisma.resume.findFirst({ where: { id, userId } });
    if (!resume) return null;

    try {
      const parser = await createCvParser();
      const cvData = await parser.parse(resume.rawText);

      await prisma.resume.update({
        where: { id },
        data: { parsedJson: cvData as any },
      });

      return { id: resume.id, extracted: cvData };
    } catch (err) {
      throw new Error(
        `Failed to extract CV data: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

export const resumeService = new ResumeService();
