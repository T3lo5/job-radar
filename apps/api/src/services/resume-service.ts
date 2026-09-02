import { prisma } from '../db/prisma.js'
import { saveFile, deleteFile, readFileStream } from './file-storage.js'
import { extractText } from './text-extraction.js'
import { createCvParser } from './ai/factory.js'

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]

const MAX_FILE_SIZE = 10 * 1024 * 1024

export class ResumeService {
  async upload(file: {
    filename: string
    mimetype: string
    toBuffer: () => Promise<Buffer>
  }) {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new Error('Invalid file type. Only PDF and DOCX are allowed.')
    }

    const buffer = await file.toBuffer()

    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error('File too large. Maximum size is 10MB.')
    }

    let rawText: string
    try {
      rawText = await extractText(buffer, file.mimetype)
    } catch (err) {
      throw new Error(
        `Failed to extract text: ${err instanceof Error ? err.message : String(err)}`,
      )
    }

    const stored = await saveFile(buffer, file.filename, file.mimetype)

    const user = await prisma.user.findFirst()
    if (!user) {
      await deleteFile(stored.filename)
      throw new Error('No user found')
    }

    const resume = await prisma.resume.create({
      data: {
        userId: user.id,
        filename: stored.filename,
        mimeType: file.mimetype,
        rawText,
        isDefault: false,
      },
    })

    return {
      id: resume.id,
      filename: resume.filename,
      mimeType: resume.mimeType,
      size: stored.size,
      uploadedAt: resume.uploadedAt,
    }
  }

  async list() {
    const user = await prisma.user.findFirst()
    if (!user) return []

    return prisma.resume.findMany({
      where: { userId: user.id },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        isDefault: true,
        uploadedAt: true,
      },
    })
  }

  async getById(id: string) {
    const resume = await prisma.resume.findUnique({ where: { id } })
    if (!resume) return null

    return { resume, stream: readFileStream(resume.filename) }
  }

  async getText(id: string) {
    return prisma.resume.findUnique({
      where: { id },
      select: { id: true, rawText: true },
    })
  }

  async delete(id: string) {
    const resume = await prisma.resume.findUnique({ where: { id } })
    if (!resume) return false

    await deleteFile(resume.filename)
    await prisma.resume.delete({ where: { id } })
    return true
  }

  async extract(id: string) {
    const resume = await prisma.resume.findUnique({ where: { id } })
    if (!resume) return null

    try {
      const parser = await createCvParser()
      const cvData = await parser.parse(resume.rawText)

      await prisma.resume.update({
        where: { id },
        data: { parsedJson: cvData as any },
      })

      return { id: resume.id, extracted: cvData }
    } catch (err) {
      throw new Error(
        `Failed to extract CV data: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
}

export const resumeService = new ResumeService()
