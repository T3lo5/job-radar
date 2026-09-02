import { useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { jobsApi, matchApi, applicationsApi, type Job, type MatchResult } from '../services/api'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select'
import { JobsSkeleton } from '../components/skeletons/jobs-skeleton'
import { EmptyState } from '../components/empty-state'
import { ErrorBoundary } from '../components/error-boundary'
import { toast } from '../components/ui/toast'
import { REMOTE_MODE_LABELS, SENIORITY_LABELS } from '@job-radar/shared'
import { SENIORITY_COLORS } from '../lib/colors'
import { Badge } from '../components/ui/badge'
import { Briefcase, ChevronLeft } from 'lucide-react'

interface Filters {
  search: string
  remote: string
  seniority: string
  status: string
  minScore: number
  sortBy: 'match' | 'date' | 'title'
}

function JobsPageContent() {
  const [filters, setFilters] = useState<Filters>({
    search: '',
    remote: '',
    seniority: '',
    status: '',
    minScore: 0,
    sortBy: 'date',
  })
  const queryClient = useQueryClient()

  const { data: existingApplications } = useQuery({
    queryKey: ['applications'],
    queryFn: () => applicationsApi.getList({ limit: 100 }),
  })

  const { data: matchResults } = useQuery({
    queryKey: ['match-results'],
    queryFn: () => matchApi.getResults(),
  })

  const { data, fetchNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['jobs', filters],
    queryFn: ({ pageParam = 1 }) =>
      jobsApi.getList({
        page: pageParam,
        limit: 20,
        search: filters.search || undefined,
        remote: filters.remote || undefined,
        seniority: filters.seniority || undefined,
        status: filters.status || undefined,
      }),
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.page >= lastPage.pagination.totalPages) return undefined
      return lastPage.pagination.page + 1
    },
    initialPageParam: 1,
  })

  const evaluateMatch = useMutation({
    mutationFn: (jobId: string) => matchApi.evaluate(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-results'] })
      toast.success('Match avaliado com sucesso')
    },
    onError: () => toast.error('Erro ao avaliar match'),
  })

  const createApplication = useMutation({
    mutationFn: (jobId: string) => applicationsApi.create(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      toast.success('Candidatura criada com sucesso')
    },
    onError: () => toast.error('Erro ao criar candidatura'),
  })

  const [trackedJobs, setTrackedJobs] = useState<Set<string>>(() => {
    const apps = existingApplications?.data ?? []
    return new Set(apps.map((a) => a.job.id))
  })

  const allJobs = data?.pages.flatMap((page) => page.data) ?? []
  const totalJobs = data?.pages[0]?.pagination.total ?? 0
  const totalPages = data?.pages[0]?.pagination.totalPages ?? 0
  const currentPage = data?.pages.length ?? 0

  const matchResultsMap = new Map<string, MatchResult>()
  matchResults?.forEach((r) => matchResultsMap.set(r.job.id, r))

  const handleTrack = (jobId: string) => {
    createApplication.mutate(jobId, {
      onSuccess: () => setTrackedJobs((prev) => new Set(prev).add(jobId)),
    })
  }

  const getMatchResult = (jobId: string): MatchResult | undefined => {
    return matchResultsMap.get(jobId)
  }

  const sortedJobs = [...allJobs].sort((a, b) => {
    switch (filters.sortBy) {
      case 'match':
        const scoreA = matchResultsMap.get(a.id)?.score ?? -1
        const scoreB = matchResultsMap.get(b.id)?.score ?? -1
        return scoreB - scoreA
      case 'title':
        return a.title.localeCompare(b.title)
      case 'date':
      default:
        return new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime()
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Vagas</h1>
          <p className="text-sm text-muted-foreground">{totalJobs} vagas encontradas</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-48">
              <Input
                placeholder="Buscar por título ou empresa..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
            <Select
              value={filters.remote}
              onValueChange={(value: string) => setFilters({ ...filters, remote: value })}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todas modalidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas modalidades</SelectItem>
                <SelectItem value="REMOTE">Remoto</SelectItem>
                <SelectItem value="HYBRID">Híbrido</SelectItem>
                <SelectItem value="ON_SITE">Presencial</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.seniority}
              onValueChange={(value: string) => setFilters({ ...filters, seniority: value })}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Senioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas senioridades</SelectItem>
                <SelectItem value="INTERN">Estagiário</SelectItem>
                <SelectItem value="JUNIOR">Júnior</SelectItem>
                <SelectItem value="MID">Pleno</SelectItem>
                <SelectItem value="SENIOR">Sênior</SelectItem>
                <SelectItem value="SPECIALIST">Especialista</SelectItem>
                <SelectItem value="LEAD">Lead</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.status}
              onValueChange={(value: string) => setFilters({ ...filters, status: value })}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos status</SelectItem>
                <SelectItem value="RAW">Coletado</SelectItem>
                <SelectItem value="MATCHING">Calculando match</SelectItem>
                <SelectItem value="DONE">Processado</SelectItem>
                <SelectItem value="FAILED">Com erro</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.sortBy}
              onValueChange={(value: string) => setFilters({ ...filters, sortBy: value as Filters['sortBy'] })}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Ordenar por data</SelectItem>
                <SelectItem value="match">Ordenar por match</SelectItem>
                <SelectItem value="title">Ordenar por título</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Jobs List */}
      {isLoading ? (
        <JobsSkeleton />
      ) : allJobs.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-12 w-12" />}
          title="Nenhuma vaga encontrada"
          description="Ajuste os filtros ou colete novas vagas."
        />
      ) : (
        <div className="space-y-4">
          {sortedJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              matchResult={getMatchResult(job.id)}
              onEvaluate={() => evaluateMatch.mutate(job.id)}
              evaluating={evaluateMatch.isPending}
              onTrack={() => handleTrack(job.id)}
              tracking={createApplication.isPending}
              isTracked={trackedJobs.has(job.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between py-4">
          <p className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage || currentPage >= totalPages}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Carregar mais
            </Button>
            <span className="text-sm text-muted-foreground">
              {isFetchingNextPage ? 'Carregando...' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export function JobsPage() {
  return (
    <ErrorBoundary onRetry={() => window.location.reload()}>
      <JobsPageContent />
    </ErrorBoundary>
  )
}

interface JobCardProps {
  job: Job
  matchResult?: MatchResult
  onEvaluate: () => void
  evaluating: boolean
  onTrack: () => void
  tracking: boolean
  isTracked: boolean
}

function JobCard({ job, matchResult, onEvaluate, evaluating, onTrack, tracking, isTracked }: JobCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{job.title}</h3>
              {matchResult && (
                <Badge
                  variant={
                    matchResult.score >= 80 ? 'success' :
                    matchResult.score >= 60 ? 'warning' :
                    'error'
                  }
                >
                  {matchResult.score}%
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">{job.company}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {job.location && (
                <Badge variant="default">{job.location}</Badge>
              )}
              <Badge variant="default">
                {REMOTE_MODE_LABELS[job.remote?.toLowerCase() as keyof typeof REMOTE_MODE_LABELS]?.label ?? job.remote}
              </Badge>
              {job.seniority && job.seniority !== 'UNKNOWN' && (
                <Badge
                  className={`${SENIORITY_COLORS[job.seniority]?.bg ?? 'bg-surface-2'} ${SENIORITY_COLORS[job.seniority]?.text ?? 'text-muted-foreground'}`}
                >
                  {SENIORITY_LABELS[job.seniority]?.label ?? job.seniority}
                </Badge>
              )}
              {job.salaryMin && job.salaryMax && (
                <Badge variant="default">
                  R$ {job.salaryMin} - R$ {job.salaryMax}
                </Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {job.status === 'RAW' && (
                <Badge variant="primary">Novo</Badge>
              )}
              <Badge variant="default">{job.sourceId}</Badge>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button
              size="sm"
              variant={isTracked ? 'secondary' : 'primary'}
              onClick={onTrack}
              disabled={tracking || isTracked}
            >
              {tracking ? '...' : isTracked ? '✓' : '+'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onEvaluate}
              disabled={evaluating}
            >
              {evaluating ? '...' : matchResult ? `${matchResult.score}%` : 'Avaliar match'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.open(job.url, '_blank', 'noopener,noreferrer')}
            >
              Ver vaga →
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
