import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { matchApi, jobsApi, applicationsApi } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { DashboardSkeleton } from '../components/skeletons/dashboard-skeleton';
import { EmptyState } from '../components/empty-state';
import { ErrorState } from '../components/error-state';
import { ErrorBoundary } from '../components/error-boundary';
import { CHART_COLORS } from '../lib/colors';
import { Badge } from '../components/ui/badge';
import { CheckCircle, AlertCircle, BarChart3 } from 'lucide-react';

interface PendingFollowUp {
  id: string;
  jobId: string;
  jobTitle: string;
  jobCompany: string;
  jobUrl: string;
  status: string;
  followUpAt: string | null;
  daysIdle: number;
  cadenceDays: number;
  lastEvent: {
    id: string;
    toStatus: string;
    note: string | null;
    createdAt: string;
  } | null;
}

function DashboardContent() {
  const navigate = useNavigate();

  const {
    data: jobsStats,
    isLoading: jobsStatsLoading,
    isError: jobsStatsError,
    error: jobsStatsErrorObj,
    refetch: refetchJobsStats,
  } = useQuery({
    queryKey: ['jobs-stats'],
    queryFn: jobsApi.getStats,
    refetchInterval: 300_000,
  });

  const {
    data: matchStats,
    isLoading: matchStatsLoading,
    isError: matchStatsError,
    error: matchStatsErrorObj,
    refetch: refetchMatchStats,
  } = useQuery({
    queryKey: ['match-stats'],
    queryFn: matchApi.getStats,
    refetchInterval: 300_000,
  });

  const {
    data: matchResults,
    isLoading: matchResultsLoading,
    isError: matchResultsError,
    error: matchResultsErrorObj,
    refetch: refetchMatchResults,
  } = useQuery({
    queryKey: ['match-results'],
    queryFn: matchApi.getResults,
    refetchInterval: 300_000,
  });

  const {
    data: recentJobs,
    isLoading: recentJobsLoading,
    isError: recentJobsError,
    error: recentJobsErrorObj,
    refetch: refetchRecentJobs,
  } = useQuery({
    queryKey: ['recent-jobs'],
    queryFn: () => jobsApi.getList({ limit: 10 }),
    refetchInterval: 300_000,
  });

  const {
    data: pendingFollowUps,
    isLoading: pendingFollowUpsLoading,
    isError: pendingFollowUpsError,
    refetch: refetchPendingFollowUps,
  } = useQuery({
    queryKey: ['pending-follow-ups'],
    queryFn: () => applicationsApi.getPendingFollowUps(),
    refetchInterval: 300_000,
  });

  const followUps: PendingFollowUp[] = pendingFollowUps ?? [];

  if (
    jobsStatsLoading ||
    matchStatsLoading ||
    matchResultsLoading ||
    recentJobsLoading ||
    pendingFollowUpsLoading
  ) {
    return <DashboardSkeleton />;
  }

  // Sem isto, API fora virava "0 vagas", "0 candidaturas" e gráficos vazios —
  // números falsos com cara de verdade.
  if (
    jobsStatsError ||
    matchStatsError ||
    matchResultsError ||
    recentJobsError ||
    pendingFollowUpsError
  ) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral das suas vagas e candidaturas
          </p>
        </div>
        <ErrorState
          title="Não foi possível carregar o dashboard"
          error={
            jobsStatsErrorObj ?? matchStatsErrorObj ?? matchResultsErrorObj ?? recentJobsErrorObj
          }
          onRetry={() => {
            void refetchJobsStats();
            void refetchMatchStats();
            void refetchMatchResults();
            void refetchRecentJobs();
            void refetchPendingFollowUps();
          }}
        />
      </div>
    );
  }

  // Contagens vêm do agregado do servidor: a lista é o top 50, então derivar
  // "vagas avaliadas" dela subcontava a partir do 51º match.
  const porFaixa = (range: string) =>
    matchStats?.distribution.find((d) => d.range === range)?.count ?? 0;

  const highMatchCount = porFaixa('90+') + porFaixa('80-89');
  const mediumMatchCount = porFaixa('70-79') + porFaixa('60-69');

  const distributionData = [
    { name: 'Excelente', value: porFaixa('90+') },
    { name: 'Muito boa', value: porFaixa('80-89') },
    { name: 'Boa', value: porFaixa('70-79') },
    { name: 'Possível', value: porFaixa('60-69') },
    { name: 'Baixa', value: porFaixa('50-59') + porFaixa('<50') },
  ].filter((d) => d.value > 0);

  const statusData = jobsStats?.byStatus
    ? Object.entries(jobsStats.byStatus).map(([name, value]) => ({ name, value: value as number }))
    : [];

  const scoreRange = (name: string) => {
    switch (name) {
      case 'Excelente':
        return { minScore: 90 };
      case 'Muito boa':
        return { minScore: 80, maxScore: 89 };
      case 'Boa':
        return { minScore: 70, maxScore: 79 };
      case 'Possível':
        return { minScore: 60, maxScore: 69 };
      case 'Baixa':
        return { maxScore: 59 };
      default:
        return {};
    }
  };

  const handleQualityClick = (entry: { name: string }) => {
    const params = new URLSearchParams();
    const range = scoreRange(entry.name);
    if (range.minScore != null) params.set('minScore', String(range.minScore));
    if (range.maxScore != null) params.set('maxScore', String(range.maxScore));
    navigate(`/jobs?${params.toString()}`);
  };

  const handleStatusClick = (entry: { name: string }) => {
    navigate(`/jobs?status=${encodeURIComponent(entry.name)}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral das suas vagas e candidaturas
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{jobsStats?.total ?? 0}</div>
            <p className="text-sm text-muted-foreground">Total de vagas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-success">{highMatchCount}</div>
            <p className="text-sm text-muted-foreground">Alta aderência (≥80)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-warning">{mediumMatchCount}</div>
            <p className="text-sm text-muted-foreground">Média aderência (60-79)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{matchStats?.total ?? 0}</div>
            <p className="text-sm text-muted-foreground">Vagas avaliadas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de matches</CardTitle>
          </CardHeader>
          <CardContent>
            {distributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    onClick={handleQualityClick}
                  >
                    {distributionData.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Sem dados ainda</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vagas por status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={statusData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    fill="hsl(210 98% 55%)"
                    onClick={handleStatusClick}
                    style={{ cursor: 'pointer' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Sem dados ainda</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Melhores vagas</CardTitle>
        </CardHeader>
        <CardContent>
          {matchResults?.data && matchResults.data.length > 0 ? (
            <div className="space-y-3">
              {matchResults.data.slice(0, 5).map((match) => {
                return (
                  <div key={match.id} className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-3">
                      {match.score >= 80 ? (
                        <CheckCircle className="h-4 w-4 text-success" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-warning" />
                      )}
                      <div>
                        <div className="font-medium">{match.job.title}</div>
                        <div className="text-sm text-muted-foreground">{match.job.company}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          match.score >= 80 ? 'success' : match.score >= 60 ? 'warning' : 'error'
                        }
                      >
                        {match.score}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<BarChart3 className="h-12 w-12" />}
              title="Nenhuma vaga avaliada ainda"
              description="Colete vagas e avalie matches para ver os resultados aqui."
              actionLabel="Ver vagas"
              actionHref="/jobs"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vagas recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentJobs?.data && recentJobs.data.length > 0 ? (
            <div className="space-y-2">
              {recentJobs.data.slice(0, 5).map((job) => (
                <div key={job.id} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <div className="font-medium">{job.title}</div>
                    <div className="text-sm text-muted-foreground">{job.company}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(job.collectedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nenhuma vaga coletada ainda"
              description="Configure fontes de vagas em Configurações para começar."
              actionLabel="Configurar fontes"
              actionHref="/settings"
              className="py-8"
            />
          )}
        </CardContent>
      </Card>

      {/* Follow-ups vencidos (anti-ghosting) */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Sem retorno para cobrar</CardTitle>
          {followUps.length > 0 && (
            <span className="text-xs font-bold px-2 py-1 rounded bg-error text-error-foreground">
              {followUps.length}
            </span>
          )}
        </CardHeader>
        <CardContent>
          {followUps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma candidatura sem retorno para hoje.
            </p>
          ) : (
            <div className="space-y-2">
              {followUps.slice(0, 5).map((fup) => (
                <div
                  key={fup.id}
                  className="flex items-center justify-between border-b pb-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-3 w-3 text-warning shrink-0" />
                    <div>
                      <div className="font-medium">{fup.jobTitle}</div>
                      <div className="text-muted-foreground">{fup.jobCompany}</div>
                      <div className="text-xs text-muted-foreground">
                        {fup.daysIdle} dia(s) sem retorno
                      </div>
                    </div>
                  </div>
                  <Link
                    to={`/jobs/${fup.jobId}/kit`}
                    className="text-xs text-accent hover:underline"
                  >
                    Ver kit
                  </Link>
                </div>
              ))}
              {followUps.length > 5 && (
                <p className="text-xs text-muted-foreground mt-2">
                  +{followUps.length - 5} outras. Veja todas em{' '}
                  <Link to="/applications" className="text-accent hover:underline">
                    Candidaturas
                  </Link>
                  .
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardPage() {
  return (
    <ErrorBoundary onRetry={() => window.location.reload()}>
      <DashboardContent />
    </ErrorBoundary>
  );
}
