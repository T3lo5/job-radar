import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { analyticsApi } from '../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Skeleton } from '../components/ui/skeleton'
import { EmptyState } from '../components/empty-state'
import { ErrorBoundary } from '../components/error-boundary'
import { BarChart3 } from 'lucide-react'

const PERIODS = [
  { label: '7 dias', value: 7 },
  { label: '30 dias', value: 30 },
  { label: '90 dias', value: 90 },
]

function AnalyticsContent() {
  const [days, setDays] = useState(30)

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', days],
    queryFn: () => analyticsApi.getOverview(days),
  })

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
    )
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

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{data?.applications.total ?? 0}</div>
            <p className="text-sm text-muted-foreground">Total aplicações</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-accent">
              {data?.applications.applied ?? 0}
            </div>
            <p className="text-sm text-muted-foreground">Aplicadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-success">
              {data?.rates.interviewRate ? (data.rates.interviewRate * 100).toFixed(0) + '%' : '0%'}
            </div>
            <p className="text-sm text-muted-foreground">Taxa entrevista</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-warning">
              {data?.applications.offers ?? 0}
            </div>
            <p className="text-sm text-muted-foreground">Ofertas</p>
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
                  <Bar dataKey="count" fill="hsl(210 98% 55%)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={<BarChart3 className="h-10 w-10" />}
                title="Sem dados de matches"
                description="Avalie matches de vagas para ver a distribuição."
                className="py-8"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Funil de Aplicações</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.applications.byStatus ? (
              <div className="space-y-2">
                {Object.entries(data.applications.byStatus).map(([status, count]) => (
                  <div key={status} className="flex justify-between items-center">
                    <span className="text-sm">{status}</span>
                    <span className="font-medium">{count as number}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Sem dados de aplicações"
                description="Comece aplicando para vagas."
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
                  <div key={skill.name} className="flex justify-between items-center">
                    <span className="text-sm">{skill.name}</span>
                    <span className="text-sm text-muted-foreground">{skill.count} vagas</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nenhuma skill encontrada"
                description="Aplique a vagas para ver skills frequentes."
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
                  <div key={gap.name} className="flex justify-between items-center">
                    <span className="text-sm">{gap.name}</span>
                    <span className="text-sm text-muted-foreground">{gap.jobCount} vagas</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nenhum gap encontrado"
                description="Seu perfil está completo!"
                className="py-8"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function AnalyticsPage() {
  return (
    <ErrorBoundary onRetry={() => window.location.reload()}>
      <AnalyticsContent />
    </ErrorBoundary>
  )
}
