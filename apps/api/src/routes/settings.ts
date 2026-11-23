import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { settingsService } from '../services/settings-service.js';
import { setupCronSchedule, nextRunFor } from '../workers/job-collection.js';
import { CRON_SETTINGS, DEFAULT_CRON, SETTINGS_SCOPE } from '../services/settings-keys.js';
import { scopeSchema } from '../utils/validation.js';

const settingSetSchema = z.object({
  // Escopo fechado: antes qualquer string era aceita.
  scope: scopeSchema,
  key: z.string().min(1).max(100),
  value: z.string(),
  isSecret: z.boolean().default(false),
});

export interface SettingsRouteDeps {
  rescheduleCron: typeof setupCronSchedule;
}

export function settingsRoutesWith(deps: SettingsRouteDeps) {
  return async function settingsRoutes(app: FastifyInstance) {
    // GET /api/settings/:scope
    app.get(
      '/api/settings/:scope',
      {
        schema: {
          params: z.object({ scope: z.string().min(1).max(50) }),
        },
      },
      async (request) => {
        const { scope } = request.params as { scope: string };
        const settings = await settingsService.getAll(scope);

        // Para o cron, o que interessa não é só o texto salvo: é quando ele vai
        // rodar de verdade. A UI mostrava o padrão e deixava o usuário supor.
        if (scope === SETTINGS_SCOPE.CRON) {
          const jobCollectionCron =
            settings[CRON_SETTINGS.JOB_COLLECTION] ?? DEFAULT_CRON.JOB_COLLECTION;
          const dailyReportCron = settings[CRON_SETTINGS.DAILY_REPORT] ?? DEFAULT_CRON.DAILY_REPORT;
          return {
            scope,
            settings,
            nextRuns: {
              jobCollectionCron: nextRunFor(jobCollectionCron),
              dailyReportCron: nextRunFor(dailyReportCron),
            },
          };
        }

        return { scope, settings };
      },
    );

    // POST /api/settings
    app.post(
      '/api/settings',
      {
        schema: {
          body: settingSetSchema,
        },
      },
      async (request, reply) => {
        const { scope, key, value, isSecret } = request.body as z.infer<typeof settingSetSchema>;
        await settingsService.set(scope, key, value, isSecret);
        // Qualquer escrita no escopo cron precisa reagendar na hora; esta rota
        // também é uma porta para mudar o horário.
        if (scope === SETTINGS_SCOPE.CRON) {
          await deps.rescheduleCron();
        }
        return reply.status(204).send();
      },
    );
  };
}

export const settingsRoutes = settingsRoutesWith({ rescheduleCron: setupCronSchedule });
