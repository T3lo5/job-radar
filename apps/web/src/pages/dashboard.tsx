import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { matchApi, jobsApi } from '../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { DashboardSkeleton } from '../components/skeletons/dashboard-skeleton'
import { EmptyState } from '../components/empty-state'
import { ErrorBoundary } from '../components/error-boundary'
import { CHART_COLORS } from '../lib/colors'
import { Badge } from '../components/ui/badge'
import { CheckCircle, AlertCircle, BarChart3 } from 'lucide-react'

function DashboardContent() {
  const { data: jobsStats, isLoading: jobsStatsLoading } = useQuery({
    queryKey: ['jobs-stats'],
    queryFn: jobsApi.getStats,
    refetchInterval: 300_000,
  })

  const { data: matchResults, isLoading: matchResultsLoading } = useQuery({
    queryKey: ['match-results'],
    queryFn: matchApi.getResults,
    refetchInterval: 300_000,
  })

  const { data: recentJobs, isLoading: recentJobsLoading } = useQuery({
    queryKey: ['recent-jobs'],
    queryFn: () => jobsApi.getList({ limit: 10 }),
    refetchInterval: 300_000,
  })

  if (jobsStatsLoading || matchResultsLoading || recentJobsLoading) {
    return <DashboardSkeleton />
  }

  const highMatchCount = matchResults?.filter((m) => m.score >= 80).length ?? 0
  const mediumMatchCount = matchResults?.filter((m) => m.score >= 60 && m.score < 80).length ?? 0

  const distributionData = [
    { name: 'Excelente', value: matchResults?.filter((m) => m.score >= 90).length ?? 0 },
    { name: 'Muito boa', value: matchResults?.filter((m) => m.score >= 80 && m.score < 90).length ?? 0 },
    { name: 'Boa', value: matchResults?.filter((m) => m.score >= 70 && m.score < 80).length ?? 0 },
    { name: 'Possível', value: matchResults?.filter((m) => m.score >= 60 && m.score < 70).length ?? 0 },
    { name: 'Baixa', value: matchResults?.filter((m) => m.score < 60).length ?? 0 },
  ].filter((d) => d.value > 0)

  const statusData = jobsStats?.byStatus
    ? Object.entries(jobsStats.byStatus).map(([name, value]) => ({ name, value: value as number }))
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral das suas vagas e candidaturas</p>
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
            <div className="text-2xl font-bold">{matchResults?.length ?? 0}</div>
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
                  >
                    {distributionData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
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
                  <Bar dataKey="value" fill="hsl(210 98% 55%)" />
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
          {matchResults && matchResults.length > 0 ? (
            <div className="space-y-3">
              {matchResults.slice(0, 5).map((match) => {
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
                           match.score >= 80 ? 'success' :
                           match.score >= 60 ? 'warning' :
                           'error'
                         }
                       >
                         {match.score}%
                       </Badge>
                     </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState
              icon={<BarChart3 className="h-12 w-12" />}
              title="Nenhuma vaga avaliada ainda"
              description="Colete vagas e avalie matches para ver os resultados aqui."
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
              className="py-8"
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function DashboardPage() {
  return (
    <ErrorBoundary onRetry={() => window.location.reload()}>
      <DashboardContent />
    </ErrorBoundary>
  )
}
