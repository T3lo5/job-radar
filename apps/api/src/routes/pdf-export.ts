import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { generatePdf } from '../services/pdf-generator.js'

export async function pdfExportRoutes(app: FastifyInstance) {
  // POST /api/cv/export-pdf — export optimized CV as PDF
  app.post<{
    Body: { resumeId: string; jobId: string; optimizedText?: string }
  }>(
    '/api/cv/export-pdf',
    {
      schema: {
        body: z.object({
          resumeId: z.string().cuid(),
          jobId: z.string().cuid(),
          optimizedText: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { resumeId, jobId, optimizedText } = request.body

      const resume = await prisma.resume.findUnique({
        where: { id: resumeId },
      })
      if (!resume) {
        return reply.status(404).send({ error: 'Resume not found' })
      }

      const textToExport = optimizedText ?? resume.rawText

      try {
        const pdfBuffer = await generatePdf(textToExport)

        // Save version
        await prisma.resumeVersion.create({
          data: {
            resumeId,
            jobId: jobId ?? null,
            content: textToExport,
            changesNote: optimizedText ? 'Optimized version' : 'Original export',
          },
        })

        reply.header('Content-Type', 'application/pdf')
        reply.header('Content-Disposition', `attachment; filename="cv-${resumeId}.pdf"`)
        return reply.send(pdfBuffer)
      } catch (err) {
        return reply.status(422).send({
          error: `Failed to generate PDF: ${err instanceof Error ? err.message : String(err)}`,
        })
      }
    },
  )

  // GET /api/cv/versions/:resumeId — list CV versions
  app.get(
    '/api/cv/versions/:resumeId',
    { schema: { params: z.object({ resumeId: z.string().cuid() }) } },
    async (request) => {
      const { resumeId } = request.params as { resumeId: string }

      return prisma.resumeVersion.findMany({
        where: { resumeId },
        orderBy: { generatedAt: 'desc' },
        select: {
          id: true,
          jobId: true,
          changesNote: true,
          generatedAt: true,
        },
      })
    },
  )
}
