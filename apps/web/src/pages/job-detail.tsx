import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { jobsApi, matchApi, cvApi } from '../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { EmptyState } from '../components/empty-state'
import { ErrorBoundary } from '../components/error-boundary'
import { toast } from '../components/ui/toast'
import { matchLabelFor, MATCH_LABELS, REMOTE_MODE_LABELS } from '@job-radar/shared'
import { ExternalLink, FileText, Download, Loader2 } from 'lucide-react'

function JobDetailContent() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobsApi.getById(id!),
    enabled: !!id,
  })

  const { data: matchResult } = useQuery({
    queryKey: ['match-result', id],
    queryFn: () => matchApi.getResults().then((r) => r.find((m) => m.job.id === id)),
    enabled: !!id,
  })

  const evaluateMutation = useMutation({
    mutationFn: () => matchApi.evaluate(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-result', id] })
      toast.success('Match avaliado com sucesso')
    },
    onError: () => toast.error('Erro ao avaliar match'),
  })

  const optimizeCvMutation = useMutation({
    mutationFn: () =>
      cvApi.optimize({
        jobId: id,
      }),
    onSuccess: (data) => {
      toast.success('CV otimizado com sucesso!')
      // In a real app, you'd navigate to a preview page or open a modal
      console.log('Optimized CV:', data)
    },
    onError: () => toast.error('Erro ao otimizar CV'),
  })

  const exportPdfMutation = useMutation({
    mutationFn: () =>
      cvApi.exportPdf({
        resumeId: 'default', // This should come from user's default resume
        jobId: id,
        optimizedText: optimizeCvMutation.data?.optimizedText,
      }),
    onError: () => toast.error('Erro ao gerar PDF'),
  })

  if (jobLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-32" />
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/4" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!job) {
    return (
      <EmptyState
        title="Vaga não encontrada"
        description="A vaga que você está procurando não existe ou foi removida."
        action={<Button onClick={() => navigate('/jobs')}>Ver todas as vagas</Button>}
      />
    )
  }

  const match = matchResult?.job.id === id ? matchResult : null

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/jobs">← Voltar para vagas</Link>
      </Button>

      {/* Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{job.title}</h1>
              <p className="text-lg text-muted-foreground">{job.company}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                {job.location && (
                  <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">{job.location}</span>
                )}
                <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
                  {REMOTE_MODE_LABELS[job.remote?.toLowerCase() as keyof typeof REMOTE_MODE_LABELS]?.label ?? job.remote}
                </span>
                {job.salaryMin && job.salaryMax && (
                  <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
                    R$ {job.salaryMin} - R$ {job.salaryMax} {job.salaryCurrency}
                  </span>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={job.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                Ver vaga original
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Match Score */}
      {match ? (
        <Card>
          <CardHeader>
            <CardTitle>Score de Match</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold">{match.score}%</div>
              <div>
                <span className="ml-2 font-medium">
                  {MATCH_LABELS[matchLabelFor(match.score)].label}
                </span>
              </div>
            </div>
            {match.breakdown && (
              <div className="mt-4 grid gap-2 md:grid-cols-4">
                {Object.entries(match.breakdown).map(([key, value]) => (
                  <div key={key} className="rounded bg-surface-2 p-2">
                    <div className="text-xs text-muted-foreground capitalize">{key}</div>
                    <div className="font-medium">{value as number}%</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">
                Esta vaga ainda não foi avaliada.
              </p>
              <Button
                onClick={() => evaluateMutation.mutate()}
                disabled={evaluateMutation.isPending}
              >
                {evaluateMutation.isPending ? 'Avaliando...' : 'Avaliar Match'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle>Descrição</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap text-sm">{job.description}</div>
        </CardContent>
      </Card>

      {/* Application Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button>Marcar como aplicada</Button>
            <Button
              variant="outline"
              onClick={() => optimizeCvMutation.mutate()}
              disabled={optimizeCvMutation.isPending}
            >
              {optimizeCvMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Otimizando...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-1" />
                  Gerar CV otimizado
                </>
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={() => exportPdfMutation.mutate()}
              disabled={exportPdfMutation.isPending || !optimizeCvMutation.data}
            >
              {exportPdfMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Gerando PDF...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-1" />
                  Baixar PDF
                </>
              )}
            </Button>
            <Button variant="outline">Arquivar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function JobDetailPage() {
  return (
    <ErrorBoundary onRetry={() => window.location.reload()}>
      <JobDetailContent />
    </ErrorBoundary>
  )
}
