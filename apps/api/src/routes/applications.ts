import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ATS_PROVIDERS } from '@job-radar/shared';
import { applicationService, kitToCsv } from '../services/application-service.js';
import {
  applicationAttachmentService,
  ATTACHMENT_KINDS,
  AttachmentError,
} from '../services/application-attachment-service.js';
import { getCurrentProfile, getCurrentUserId } from '../lib/current-user.js';
import { prisma } from '../db/prisma.js';
import { settingsService } from '../services/settings-service.js';
import { APP_SETTINGS, SETTINGS_SCOPE } from '../services/settings-keys.js';
import { daysIdleSince, nextFollowUpDate } from '../utils/follow-up.js';

const createApplicationSchema = z.object({
  jobId: z.string().cuid(),
  notes: z.string().max(5000).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum([
    'FOUND',
    'INTERESTING',
    'CV_PREPARED',
    'APPLIED',
    'INTERVIEW',
    'REJECTED',
    'OFFER',
    'ARCHIVED',
  ]),
  note: z.string().max(1000).optional(),
});

const updateApplicationSchema = z.object({
  notes: z.string().max(5000).optional(),
  salary: z.number().int().min(0).nullable().optional(),
  result: z.string().max(500).optional(),
  contacts: z.record(z.string(), z.unknown()).optional(),
  followUpAt: z.string().datetime().nullable().optional(),
  atsUsed: z.enum(ATS_PROVIDERS).nullable().optional(),
});

const listApplicationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum([
      'FOUND',
      'INTERESTING',
      'CV_PREPARED',
      'APPLIED',
      'INTERVIEW',
      'REJECTED',
      'OFFER',
      'ARCHIVED',
    ])
    .optional(),
  jobId: z.string().cuid().optional(),
});

const exportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
});

const uploadQuerySchema = z.object({
  kind: z.enum(ATTACHMENT_KINDS).default('other'),
});

const attachmentParamsSchema = z.object({
  id: z.string().cuid(),
  attachmentId: z.string().cuid(),
});

/**
 * `Content-Disposition` para download.
 *
 * `filename` em ASCII é o fallback de clientes antigos; `filename*` (RFC 5987)
 * preserva acento e espaço no nome real. Sem isso, "carta de apresentação.pdf"
 * virava "carta de apresentao.pdf".
 */
function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** Nome de arquivo seguro para o export (sem barras nem caracteres de controle). */
function slug(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'vaga'
  );
}

export async function applicationRoutes(app: FastifyInstance) {
  async function requireProfileId(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<string | null> {
    const profile = await getCurrentProfile(request);
    if (!profile) {
      reply.status(404).send({ error: 'Profile not found' });
      return null;
    }
    return profile.id;
  }

  app.post(
    '/api/applications',
    { schema: { body: createApplicationSchema } },
    async (request, reply) => {
      const profileId = await requireProfileId(request, reply);
      if (!profileId) return reply;

      const { jobId, notes } = request.body as z.infer<typeof createApplicationSchema>;
      const result = await applicationService.create(profileId, { jobId, notes });

      if (result === null) {
        return reply.status(404).send({ error: 'Job or profile not found' });
      }

      if ('conflict' in result) {
        return reply.status(409).send({
          error: 'Application already exists',
          applicationId: result.applicationId,
        });
      }

      return reply.status(201).send({ applicationId: result.applicationId });
    },
  );

  app.get(
    '/api/applications',
    { schema: { querystring: listApplicationsSchema } },
    async (request) => {
      const query = request.query as z.infer<typeof listApplicationsSchema>;
      const profile = await getCurrentProfile(request);
      if (!profile) {
        return {
          data: [],
          pagination: { page: query.page, limit: query.limit, total: 0, totalPages: 0 },
        };
      }
      return applicationService.list(profile.id, query);
    },
  );

  // Candidaturas sem retorno: followUpAt vencido ou nunca agendado, excluindo
  // status finais (ARCHIVED/REJECTED/OFFER). Usado pelo card do dashboard.
  app.get('/api/applications/follow-ups-pending', async (request, reply) => {
    const profile = await getCurrentProfile(request);
    if (!profile) {
      return reply.status(404).send({ error: 'Profile not found' });
    }

    const now = new Date();

    const pending = await prisma.application.findMany({
      where: {
        profileId: profile.id,
        status: {
          notIn: ['ARCHIVED', 'REJECTED', 'OFFER'],
        },
        AND: [
          {
            OR: [{ followUpAt: null }, { followUpAt: { lte: now } }],
          },
        ],
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: true,
            url: true,
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        followUpAt: 'asc',
      },
    });

    const cadenceDaysRaw = await settingsService.get(
      SETTINGS_SCOPE.APP,
      APP_SETTINGS.FOLLOW_UP_CADENCE_DAYS,
    );
    const cadenceDays =
      cadenceDaysRaw && !Number.isNaN(Number(cadenceDaysRaw))
        ? Math.max(1, Math.min(365, Number(cadenceDaysRaw)))
        : 7;

    return pending.map((app) => {
      const lastEvent = app.events[0];
      const lastInteraction = lastEvent ? lastEvent.createdAt : app.updatedAt;
      const daysIdle = daysIdleSince(lastInteraction, now);

      return {
        id: app.id,
        jobId: app.job.id,
        jobTitle: app.job.title ?? '',
        jobCompany: app.job.company ?? '',
        jobUrl: app.job.url,
        status: app.status,
        followUpAt: app.followUpAt,
        daysIdle,
        cadenceDays,
        lastEvent: lastEvent
          ? {
              id: lastEvent.id,
              toStatus: lastEvent.toStatus,
              note: lastEvent.note,
              createdAt: lastEvent.createdAt,
            }
          : null,
      };
    });
  });

  app.get(
    '/api/applications/:id',
    { schema: { params: z.object({ id: z.string().cuid() }) } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const profileId = await requireProfileId(request, reply);
      if (!profileId) return reply;

      const application = await applicationService.getById(id, profileId);
      if (!application) {
        return reply.status(404).send({ error: 'Application not found' });
      }
      return application;
    },
  );

  // --- Kit ------------------------------------------------------------------

  app.get(
    '/api/applications/:id/kit',
    { schema: { params: z.object({ id: z.string().cuid() }) } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const profileId = await requireProfileId(request, reply);
      if (!profileId) return reply;

      const kit = await applicationService.getKit(id, profileId, getCurrentUserId(request));
      if (!kit) {
        return reply.status(404).send({ error: 'Application not found' });
      }
      return kit;
    },
  );

  app.get(
    '/api/applications/:id/export',
    { schema: { params: z.object({ id: z.string().cuid() }), querystring: exportQuerySchema } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { format } = request.query as z.infer<typeof exportQuerySchema>;
      const profileId = await requireProfileId(request, reply);
      if (!profileId) return reply;

      const kit = await applicationService.getKit(id, profileId, getCurrentUserId(request));
      if (!kit) {
        return reply.status(404).send({ error: 'Application not found' });
      }

      // JSON leva tudo (eventos, anexos, match, análise); CSV é a visão
      // tabular para planilha.
      const body = format === 'csv' ? kitToCsv(kit) : JSON.stringify(kit, null, 2);
      const base = `kit-${slug(kit.application.job.company)}-${slug(kit.application.job.title)}`;

      return reply
        .header('Content-Type', format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json')
        .header('Content-Disposition', contentDisposition(`${base}.${format}`))
        .send(body);
    },
  );

  // --- Anexos ---------------------------------------------------------------

  app.get(
    '/api/applications/:id/attachments',
    { schema: { params: z.object({ id: z.string().cuid() }) } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const profileId = await requireProfileId(request, reply);
      if (!profileId) return reply;

      const attachments = await applicationAttachmentService.list(id, profileId);
      if (attachments === null) {
        return reply.status(404).send({ error: 'Application not found' });
      }
      return { attachments };
    },
  );

  app.post(
    '/api/applications/:id/attachments',
    { schema: { params: z.object({ id: z.string().cuid() }), querystring: uploadQuerySchema } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { kind } = request.query as z.infer<typeof uploadQuerySchema>;
      const profileId = await requireProfileId(request, reply);
      if (!profileId) return reply;

      if (!request.isMultipart()) {
        return reply.status(400).send({ error: 'Envie o arquivo como multipart/form-data' });
      }

      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ error: 'Nenhum arquivo enviado' });
      }

      const buffer = await file.toBuffer();
      // `toBuffer` para no limite do plugin e marca `truncated`: sem esta
      // checagem, um arquivo maior que 10 MB seria salvo pela metade.
      if (file.file.truncated) {
        return reply.status(413).send({ error: 'Arquivo muito grande. O limite é 10 MB.' });
      }

      try {
        const attachment = await applicationAttachmentService.add(
          id,
          profileId,
          {
            filename: file.filename,
            mimetype: file.mimetype,
            toBuffer: async () => buffer,
          },
          kind,
        );

        if (!attachment) {
          return reply.status(404).send({ error: 'Application not found' });
        }

        return reply.status(201).send(attachment);
      } catch (err) {
        if (err instanceof AttachmentError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  app.get(
    '/api/applications/:id/attachments/:attachmentId/download',
    { schema: { params: attachmentParamsSchema } },
    async (request, reply) => {
      const { id, attachmentId } = request.params as z.infer<typeof attachmentParamsSchema>;
      const profileId = await requireProfileId(request, reply);
      if (!profileId) return reply;

      const download = await applicationAttachmentService.open(id, attachmentId, profileId);
      if (!download) {
        return reply.status(404).send({ error: 'Attachment not found' });
      }

      return reply
        .header('Content-Type', download.attachment.mimeType)
        .header('Content-Length', String(download.attachment.size))
        .header('Content-Disposition', contentDisposition(download.attachment.originalName))
        .send(download.stream);
    },
  );

  app.delete(
    '/api/applications/:id/attachments/:attachmentId',
    { schema: { params: attachmentParamsSchema } },
    async (request, reply) => {
      const { id, attachmentId } = request.params as z.infer<typeof attachmentParamsSchema>;
      const profileId = await requireProfileId(request, reply);
      if (!profileId) return reply;

      const removed = await applicationAttachmentService.remove(id, attachmentId, profileId);
      if (!removed) {
        return reply.status(404).send({ error: 'Attachment not found' });
      }
      return reply.status(204).send();
    },
  );

  app.patch(
    '/api/applications/:id/status',
    {
      schema: {
        params: z.object({ id: z.string().cuid() }),
        body: updateStatusSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { status, note } = request.body as z.infer<typeof updateStatusSchema>;
      const profileId = await requireProfileId(request, reply);
      if (!profileId) return reply;

      const result = await applicationService.updateStatus(id, status, profileId, note);
      if (!result) {
        return reply.status(404).send({ error: 'Application not found' });
      }
      return result;
    },
  );

  app.patch(
    '/api/applications/:id',
    {
      schema: {
        params: z.object({ id: z.string().cuid() }),
        body: updateApplicationSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = request.body as z.infer<typeof updateApplicationSchema>;
      const profileId = await requireProfileId(request, reply);
      if (!profileId) return reply;

      const updated = await applicationService.update(id, profileId, {
        notes: data.notes,
        salary: data.salary,
        result: data.result,
        contacts: data.contacts,
        followUpAt: data.followUpAt ? new Date(data.followUpAt) : null,
        atsUsed: data.atsUsed,
      });
      if (!updated) {
        return reply.status(404).send({ error: 'Application not found' });
      }
      return updated;
    },
  );

  app.patch(
    '/api/applications/:id/follow-up',
    {
      schema: {
        params: z.object({ id: z.string().cuid() }),
        body: z.object({
          followUpAt: z.string().datetime().nullable(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { followUpAt } = request.body as { followUpAt: string | null };
      const profileId = await requireProfileId(request, reply);
      if (!profileId) return reply;

      const updated = await applicationService.updateFollowUp(id, profileId, followUpAt);
      if (!updated) {
        return reply.status(404).send({ error: 'Application not found' });
      }
      return updated;
    },
  );

  // Registra contato com o recrutador: cria um evento e reagenda o próximo
  // follow-up com a cadência salva (padrão 7 dias).
  app.post(
    '/api/applications/:id/contact',
    {
      schema: {
        params: z.object({ id: z.string().cuid() }),
        body: z.object({
          note: z.string().max(1000).optional(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { note } = request.body as { note?: string };
      const profileId = await requireProfileId(request, reply);
      if (!profileId) return reply;

      const application = await applicationService.getById(id, profileId);
      if (!application) {
        return reply.status(404).send({ error: 'Application not found' });
      }

      const cadenceDaysRaw = await settingsService.get(
        SETTINGS_SCOPE.APP,
        APP_SETTINGS.FOLLOW_UP_CADENCE_DAYS,
      );
      const cadenceDays =
        cadenceDaysRaw && !Number.isNaN(Number(cadenceDaysRaw))
          ? Math.max(1, Math.min(365, Number(cadenceDaysRaw)))
          : 7;

      const nextFollowUp = nextFollowUpDate(cadenceDays);

      const [updated, event] = await prisma.$transaction([
        prisma.application.update({
          where: { id },
          data: { followUpAt: nextFollowUp },
        }),
        prisma.applicationEvent.create({
          data: {
            applicationId: id,
            fromStatus: application.status,
            toStatus: application.status,
            note: note ?? 'Contato registrado (follow-up)',
          },
        }),
      ]);

      return { application: updated, event, nextFollowUp };
    },
  );

  app.delete(
    '/api/applications/:id',
    { schema: { params: z.object({ id: z.string().cuid() }) } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const profileId = await requireProfileId(request, reply);
      if (!profileId) return reply;

      const deleted = await applicationService.delete(id, profileId);
      if (!deleted) {
        return reply.status(404).send({ error: 'Application not found' });
      }
      return reply.status(204).send();
    },
  );
}
