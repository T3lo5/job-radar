import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { analyticsApi } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/empty-state';
import { ErrorState } from '../components/error-state';
import { ErrorBoundary } from '../components/error-boundary';
import { BarChart3 } from 'lucide-react';
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from '@job-radar/shared';
import { formatRate, cohortDetail } from '../lib/analytics-format';

const PERIODS = [
  { label: '7 dias', value: 7 },
  { label: '30 dias', value: 30 },
  { label: '90 dias', value: 90 },
];

function AnalyticsContent() {
  const [days, setDays] = useState(30);
  const navigate = useNavigate();

  const handleMatchRangeClick = (entry: { range: string }) => {
    const params = new URLSearchParams();
    switch (entry.range) {
      case '90+':
        params.set('minScore', '90');
        break;
      case '80-89':
        params.set('minScore', '80');
        params.set('maxScore', '89');
        break;
      case '70-79':
        params.set('minScore', '70');
        params.set('maxScore', '79');
        break;
      case '60-69':
        params.set('minScore', '60');
        params.set('maxScore', '69');
        break;
      case '50-59':
        params.set('minScore', '50');
        params.set('maxScore', '59');
        break;
      case '<50':
        params.set('maxScore', '49');
        break;
    }
    navigate(`/jobs?${params.toString()}`);
  };

  const handleSkillClick = (skillName: string) => {
    navigate(`/jobs?skill=${encodeURIComponent(skillName)}`);
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['analytics', days],
    queryFn: () => analyticsApi.getOverview(days),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-20" />
            ))}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-7 w-16 mb-1" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-display font-bold">Analytics</h1>
        </div>
        <ErrorState
          title="Não foi possível carregar o analytics"
          error={error}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-bold">Analytics</h1>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setDays(p.value)}
              className={`px-3 py-1 rounded text-sm ${
                days === p.value
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards — coorte por histórico, não foto do status atual */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{data?.cohort.total ?? 0}</div>
            <p className="text-sm text-muted-foreground">Candidaturas no período</p>
          </CardContent>
        </Card>
        <Card title="Candidaturas criadas no período que chegaram a entrevista, oferta ou rejeição, dividido pelo total criado no período.">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-accent">
              {formatRate(data?.rates.responseRate)}
            </div>
            <p className="text-sm text-muted-foreground">Respostas na coorte</p>
            <p className="text-xs text-muted-foreground">
              {cohortDetail(data?.cohort.responded, data?.cohort.total)}
            </p>
          </CardContent>
        </Card>
        <Card title="Candidaturas da coorte que chegaram a entrevista ou oferta, sobre o total da coorte.">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-success">
              {formatRate(data?.rates.interviewRate)}
            </div>
            <p className="text-sm text-muted-foreground">Entrevistas na coorte</p>
            <p className="text-xs text-muted-foreground">
              {cohortDetail(data?.cohort.interviewed, data?.cohort.total)}
            </p>
          </CardContent>
        </Card>
        <Card title="Candidaturas da coorte que chegaram a oferta, sobre o total da coorte.">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-warning">
              {formatRate(data?.rates.offerRate)}
            </div>
            <p className="text-sm text-muted-foreground">Ofertas na coorte</p>
            <p className="text-xs text-muted-foreground">
              {cohortDetail(data?.cohort.offered, data?.cohort.total)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Match Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Matches</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.matches.distribution && data.matches.distribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.matches.distribution}>
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    fill="hsl(210 98% 55%)"
                    onClick={handleMatchRangeClick}
                    style={{ cursor: 'pointer' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={<BarChart3 className="h-10 w-10" />}
                title="Sem dados de matches"
                description="Avalie matches de vagas para ver a distribuição."
                actionLabel="Avaliar matches"
                actionHref="/jobs"
                className="py-8"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição atual por status</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.applications.byStatus ? (
              <div className="space-y-2">
                {Object.entries(data.applications.byStatus).map(([status, count]) => (
                  <div key={status} className="flex justify-between items-center">
                    <span className="text-sm">
                      {APPLICATION_STATUS_LABELS[status as ApplicationStatus] ?? status}
                    </span>
                    <span className="font-medium">{count as number}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Sem dados de aplicações"
                description="Comece aplicando para vagas."
                actionLabel="Ver candidaturas"
                actionHref="/applications"
                className="py-8"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Skills */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Skills Mais Pedidas</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.skills.mostFrequent && data.skills.mostFrequent.length > 0 ? (
              <div className="space-y-2">
                {data.skills.mostFrequent.map((skill) => (
                  <div
                    key={skill.name}
                    className="flex justify-between items-center"
                    onClick={() => handleSkillClick(skill.name)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="text-sm">{skill.name}</span>
                    <span className="text-sm text-muted-foreground">{skill.count} vagas</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nenhuma skill encontrada"
                description="Aplique a vagas para ver skills frequentes."
                actionLabel="Ver vagas"
                actionHref="/jobs"
                className="py-8"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Maiores Gaps</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.skills.biggestGaps && data.skills.biggestGaps.length > 0 ? (
              <div className="space-y-2">
                {data.skills.biggestGaps.map((gap) => (
                  <div
                    key={gap.name}
                    className="flex justify-between items-center"
                    onClick={() => handleSkillClick(gap.name)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="text-sm">{gap.name}</span>
                    <span className="text-sm text-muted-foreground">{gap.jobCount} vagas</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nenhum gap encontrado"
                description="Seu perfil está completo!"
                actionLabel="Ver perfil"
                actionHref="/profile"
                className="py-8"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  return (
    <ErrorBoundary onRetry={() => window.location.reload()}>
      <AnalyticsContent />
    </ErrorBoundary>
  );
}
