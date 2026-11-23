import { prisma } from '../db/prisma.js';
import { matchLabelFor, MATCH_LABELS } from '@job-radar/shared';
import { telegramChannel } from './notifications.js';
import { escapeMarkdown } from './telegram-format.js';

interface DailyReportData {
  totalJobs: number;
  processedJobs: number;
  compatibleJobs: number;
  highMatchJobs: number;
  topJobs: Array<{
    title: string;
    company: string;
    score: number;
    location: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
    url: string;
  }>;
  pendingFollowUps: Array<{
    id: string;
    jobTitle: string;
    jobCompany: string;
    daysIdle: number;
  }>;
}

export async function generateDailyReport(): Promise<DailyReportData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalJobs, processedJobs, matches] = await Promise.all([
    prisma.job.count({
      where: { collectedAt: { gte: today } },
    }),
    prisma.job.count({
      where: { collectedAt: { gte: today }, status: 'DONE' },
    }),
    prisma.jobMatch.findMany({
      where: { computedAt: { gte: today } },
      include: { job: true },
      orderBy: { score: 'desc' },
    }),
  ]);

  const compatibleJobs = matches.filter((m) => m.score >= 60).length;
  const highMatchJobs = matches.filter((m) => m.score >= 80).length;
  const topJobs = matches.slice(0, 5).map((m) => ({
    title: m.job.title,
    company: m.job.company,
    score: m.score,
    location: m.job.location,
    salaryMin: m.job.salaryMin,
    salaryMax: m.job.salaryMax,
    url: m.job.url,
  }));

  const pendingApplications = await prisma.application.findMany({
    where: {
      status: {
        notIn: ['ARCHIVED', 'REJECTED', 'OFFER'],
      },
      AND: [
        {
          OR: [{ followUpAt: null }, { followUpAt: { lte: today } }],
        },
      ],
    },
    include: {
      job: {
        select: {
          title: true,
          company: true,
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

  const pendingFollowUps = pendingApplications.map((app) => {
    const lastEvent = app.events[0];
    const lastInteraction = lastEvent ? lastEvent.createdAt : app.updatedAt;
    const daysIdle = Math.floor(
      (today.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24),
    );
    return {
      id: app.id,
      jobTitle: app.job.title ?? '(sem título)',
      jobCompany: app.job.company ?? '(sem empresa)',
      daysIdle: Math.max(0, daysIdle),
    };
  });

  return {
    totalJobs,
    processedJobs,
    compatibleJobs,
    highMatchJobs,
    topJobs,
    pendingFollowUps,
  };
}

export async function sendDailyReport(): Promise<{
  success: boolean;
  error?: string;
}> {
  const report = await generateDailyReport();

  const today = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  let message = `📊 *Relatório Diário — ${today}*\n\n`;
  message += `📋 Vagas encontradas: *${report.totalJobs}*\n`;
  message += `✅ Processadas: *${report.processedJobs}*\n`;
  message += `🎯 Compatíveis (≥60): *${report.compatibleJobs}*\n`;
  message += `🔥 Altamente recomendadas (≥80): *${report.highMatchJobs}*\n\n`;

  if (report.topJobs.length > 0) {
    message += '🏆 *Top Vagas:*\n\n';
    for (const job of report.topJobs) {
      const label = matchLabelFor(job.score);
      const visual = MATCH_LABELS[label];
      // Dados da vaga são externos. `*` e `[` sem escape quebram o Markdown e
      // o Telegram devolve 400 — o relatório inteiro deixa de ser enviado.
      message += `${visual.emoji} *${job.score}* — ${escapeMarkdown(job.title)}\n`;
      message += `  ${escapeMarkdown(job.company)}`;
      if (job.location) message += ` — ${escapeMarkdown(job.location)}`;
      message += '\n';
      if (job.salaryMin && job.salaryMax) {
        message += `  💰 R$ ${job.salaryMin} - R$ ${job.salaryMax}\n`;
      }
      message += `  🔗 [Ver vaga](${escapeMarkdown(job.url)})\n\n`;
    }
  } else {
    message += '_Nenhuma vaga avaliada hoje._\n';
  }

  // Follow-ups vencidos: candidaturas sem retorno há mais de X dias.
  if (report.pendingFollowUps.length > 0) {
    message += `\n⏰ *Follow-ups vencidos (${report.pendingFollowUps.length}):*\n\n`;
    for (const fup of report.pendingFollowUps.slice(0, 10)) {
      message += `• ${escapeMarkdown(fup.jobTitle)} — ${escapeMarkdown(fup.jobCompany)}`;
      message += ` — ${fup.daysIdle} dia(s) sem retorno\n`;
    }
    if (report.pendingFollowUps.length > 10) {
      message += `… e mais ${report.pendingFollowUps.length - 10}.\n`;
    }
    message += '\n';
  }

  const result = await telegramChannel.send({
    text: message,
    parseMode: 'Markdown',
  });

  // Log the notification
  await prisma.notification.create({
    data: {
      channel: 'telegram',
      payload: { type: 'daily_report', date: today } as unknown as object,
      status: result.success ? 'SENT' : 'FAILED',
      sentAt: result.success ? new Date() : null,
      error: result.error,
    },
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true };
}
