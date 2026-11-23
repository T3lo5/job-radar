import { prisma } from '../db/prisma.js';
import { saveFile, deleteFile, readFileStream } from './file-storage.js';
import type { Readable } from 'node:stream';

/**
 * Anexos por candidatura.
 *
 * O kit junta carta, portfólio e comprovantes em um só lugar. O binário usa o
 * mesmo storage dos CVs (`file-storage.ts`) e o banco guarda só metadados —
 * nada de base64 em coluna de texto.
 */

export const ATTACHMENT_KINDS = ['cover_letter', 'portfolio', 'other'] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export const ATTACHMENT_KIND_LABELS: Record<AttachmentKind, string> = {
  cover_letter: 'Carta de apresentação',
  portfolio: 'Portfólio',
  other: 'Outro',
};

/**
 * Tipos aceitos. Cobre o que o candidato de fato envia: CV/carta em PDF ou
 * Word, print de conversa em imagem e texto puro.
 */
export const ALLOWED_ATTACHMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'image/png',
  'image/jpeg',
] as const;

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

/** Erro com status HTTP — a rota repassa sem transformar em 500. */
export class AttachmentError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = 'AttachmentError';
  }
}

export interface AttachmentFile {
  filename: string;
  mimetype: string;
  toBuffer: () => Promise<Buffer>;
}

export interface AttachmentSummary {
  id: string;
  applicationId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  kind: AttachmentKind;
  createdAt: Date;
  downloadUrl: string;
}

export interface AttachmentDownload {
  attachment: AttachmentSummary;
  stream: Readable;
}

function toSummary(attachment: {
  id: string;
  applicationId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  kind: string;
  createdAt: Date;
}): AttachmentSummary {
  return {
    ...attachment,
    kind: (ATTACHMENT_KINDS as readonly string[]).includes(attachment.kind)
      ? (attachment.kind as AttachmentKind)
      : 'other',
    // O binário nunca é servido pelo nome no disco: a rota valida o dono
    // antes de abrir o stream.
    downloadUrl: `/api/applications/${attachment.applicationId}/attachments/${attachment.id}/download`,
  };
}

export class ApplicationAttachmentService {
  /**
   * Sobe um anexo. Devolve `null` quando a candidatura não existe ou não
   * pertence ao perfil — quem chama responde 404 sem distinguir os casos.
   */
  async add(
    applicationId: string,
    profileId: string,
    file: AttachmentFile,
    kind: AttachmentKind,
  ): Promise<AttachmentSummary | null> {
    const application = await prisma.application.findFirst({
      where: { id: applicationId, profileId },
      select: { id: true },
    });
    if (!application) return null;

    if (!(ALLOWED_ATTACHMENT_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new AttachmentError(
        'Tipo de arquivo não suportado. Envie PDF, DOCX, DOC, TXT, PNG ou JPEG.',
        415,
      );
    }

    const buffer = await file.toBuffer();
    if (buffer.length === 0) {
      throw new AttachmentError('Arquivo vazio.', 400);
    }
    if (buffer.length > MAX_ATTACHMENT_SIZE) {
      throw new AttachmentError('Arquivo muito grande. O limite é 10 MB.', 413);
    }

    const stored = await saveFile(buffer, file.filename, file.mimetype);

    try {
      const created = await prisma.applicationAttachment.create({
        data: {
          applicationId,
          filename: stored.filename,
          originalName: file.filename,
          mimeType: stored.mimeType,
          size: stored.size,
          kind,
        },
      });

      return toSummary(created);
    } catch (err) {
      // Sem isso o arquivo ficaria órfão no disco quando o INSERT falhasse.
      await deleteFile(stored.filename).catch((err) =>
        console.error('erro ao deletar arquivo órfão:', err),
      );
      throw err;
    }
  }

  async list(applicationId: string, profileId: string): Promise<AttachmentSummary[] | null> {
    const application = await prisma.application.findFirst({
      where: { id: applicationId, profileId },
      select: { id: true },
    });
    if (!application) return null;

    const attachments = await prisma.applicationAttachment.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
    });

    return attachments.map(toSummary);
  }

  async open(
    applicationId: string,
    attachmentId: string,
    profileId: string,
  ): Promise<AttachmentDownload | null> {
    const attachment = await prisma.applicationAttachment.findFirst({
      where: {
        id: attachmentId,
        applicationId,
        application: { profileId },
      },
    });
    if (!attachment) return null;

    return { attachment: toSummary(attachment), stream: readFileStream(attachment.filename) };
  }

  /**
   * Remove metadado e arquivo. O banco é apagado primeiro: se o `unlink`
   * falhar (arquivo já sumiu), o registro sai mesmo assim e não sobra anexo
   * fantasma apontando para um caminho inexistente.
   */
  async remove(applicationId: string, attachmentId: string, profileId: string): Promise<boolean> {
    const attachment = await prisma.applicationAttachment.findFirst({
      where: {
        id: attachmentId,
        applicationId,
        application: { profileId },
      },
    });
    if (!attachment) return false;

    await prisma.applicationAttachment.delete({ where: { id: attachmentId } });
    await deleteFile(attachment.filename).catch((err) =>
      console.error('erro ao deletar anexo:', err),
    );

    return true;
  }
}

export const applicationAttachmentService = new ApplicationAttachmentService();
