import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { jobsApi, matchApi, applicationsApi, type Job, type MatchResult } from '../services/api';
import { useDebouncedValue } from '../lib/debounce';
import { handleApiError } from '../services/error-handler';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../components/ui/select';
import { JobsSkeleton } from '../components/skeletons/jobs-skeleton';
import { EmptyState } from '../components/empty-state';
import { ErrorState } from '../components/error-state';
import { ErrorBoundary } from '../components/error-boundary';
import { toast } from '../components/ui/toast';
import { REMOTE_MODE_LABELS, seniorityLabel, sourceName } from '@job-radar/shared';
import { SENIORITY_COLORS } from '../lib/colors';
import { formatSalary } from '../lib/salary';
import { Badge } from '../components/ui/badge';
import { Briefcase, ChevronLeft } from 'lucide-react';

interface Filters {
  search: string;
  remote: string;
  seniority: string;
  status: string;
  minScore: number;
  minSalary: number | null;
  maxSalary: number | null;
  minConfidence: number | null;
  skill: string;
  sortBy: 'match' | 'date' | 'title' | 'salary';
  discarded: 'active' | 'discarded' | 'all';
}

function JobsPageContent() {
  // Filtros e página vivem na URL: voltar do detalhe (`navigate(-1)`) restaura
  // exatamente a lista que o usuário estava vendo. Antes eram só estado local,
  // então o "Voltar" caía na lista crua.
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<Filters>(() => ({
    search: searchParams.get('search') ?? '',
    remote: searchParams.get('remote') ?? '',
    seniority: searchParams.get('seniority') ?? '',
    status: searchParams.get('status') ?? '',
    minScore: Number(searchParams.get('minScore')) || 0,
    minSalary: searchParams.get('minSalary') ? Number(searchParams.get('minSalary')) : null,
    maxSalary: searchParams.get('maxSalary') ? Number(searchParams.get('maxSalary')) : null,
    minConfidence: searchParams.get('minConfidence')
      ? Number(searchParams.get('minConfidence'))
      : null,
    skill: searchParams.get('skill') ?? '',
    sortBy: (searchParams.get('sortBy') as Filters['sortBy']) || 'date',
    discarded: (searchParams.get('discarded') as Filters['discarded']) || 'active',
  }));

  const targetPage = useRef(Math.max(1, Number(searchParams.get('page')) || 1));
  const queryClient = useQueryClient();

  // Busca com debounce: a URL e o input continuam respondendo na hora, mas a
  // request só sai depois de 300 ms sem digitação.
  const debouncedSearch = useDebouncedValue(filters.search, 300);

  const {
    data: existingApplications,
    isError: applicationsError,
    refetch: refetchApplications,
  } = useQuery({
    queryKey: ['applications'],
    queryFn: () => applicationsApi.getList({ limit: 100 }),
  });

  const {
    data: matchResults,
    isError: matchResultsError,
    refetch: refetchMatchResults,
  } = useQuery({
    queryKey: ['match-results'],
    queryFn: () => matchApi.getResults(),
  });

  const {
    data,
    fetchNextPage,
    isFetchingNextPage,
    isFetching,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    // O objeto do debounce entra na chave, não `filters.search`: sem isso cada
    // tecla ainda criaria uma entrada nova de cache e uma request.
    queryKey: ['jobs', { ...filters, search: debouncedSearch }],
    queryFn: ({ pageParam = 1 }) =>
      jobsApi.getList({
        page: pageParam,
        limit: 20,
        search: debouncedSearch || undefined,
        remote: filters.remote || undefined,
        seniority: filters.seniority || undefined,
        status: filters.status || undefined,
        // Ordenação e corte por score acontecem no servidor, sobre o conjunto
        // inteiro. Antes, `sortBy`/`minScore` só afetavam a página carregada.
        sort: filters.sortBy,
        discarded: filters.discarded,
        minScore: filters.minScore || undefined,
        minSalary: filters.minSalary ?? undefined,
        maxSalary: filters.maxSalary ?? undefined,
        minConfidence: filters.minConfidence ?? undefined,
        skill: filters.skill || undefined,
      }),
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.page >= lastPage.pagination.totalPages) return undefined;
      return lastPage.pagination.page + 1;
    },
    initialPageParam: 1,
    // Mantém a lista anterior durante o refetch: sem isto, digitar trocava os
    // resultados por skeleton a cada caractere.
    placeholderData: keepPreviousData,
  });

  const evaluateMatch = useMutation({
    mutationFn: (jobId: string) => matchApi.evaluate(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-results'] });
      toast.success('Match avaliado com sucesso');
    },
    onError: (error, jobId) =>
      handleApiError(error, 'evaluateMatch', () => evaluateMatch.mutate(jobId)),
  });

  const createApplication = useMutation({
    mutationFn: (jobId: string) => applicationsApi.create(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast.success('Candidatura criada com sucesso');
    },
    onError: (error, jobId) =>
      handleApiError(error, 'createApplication', () => createApplication.mutate(jobId)),
  });

  // Avalia o match de todas as vagas atualmente carregadas na tela.
  const evaluateAll = useMutation({
    mutationFn: (jobIds: string[]) => matchApi.evaluateAll(jobIds),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['match-results'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success(
        data.evaluated > 0 ? `${data.evaluated} vaga(s) avaliada(s)` : 'Nenhuma vaga para avaliar',
      );
    },
    onError: (error) => handleApiError(error, 'evaluateMatch', () => evaluateAll.mutate(allJobIds)),
  });

  const discardJob = useMutation({
    mutationFn: (jobId: string) => jobsApi.discard(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Vaga descartada');
    },
    onError: (error, jobId) => handleApiError(error, 'discardJob', () => discardJob.mutate(jobId)),
  });

  const restoreJob = useMutation({
    mutationFn: (jobId: string) => jobsApi.restore(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Vaga restaurada');
    },
    onError: (error, jobId) => handleApiError(error, 'restoreJob', () => restoreJob.mutate(jobId)),
  });

  // Derivado, não guardado em estado: o inicializador de useState rodava no
  // primeiro render, quando `existingApplications` ainda era undefined — o Set
  // nascia vazio e nunca sincronizava. Vagas já no quadro apareciam como "não
  // rastreadas" e clicar gerava 409.
  const trackedJobs = useMemo(
    () => new Set((existingApplications?.data ?? []).map((a) => a.job.id)),
    [existingApplications?.data],
  );

  const allJobs = data?.pages.flatMap((page) => page.data) ?? [];
  // Ids das vagas carregadas, estáveis entre renders (chave do useMemo é o
  // array de páginas, não `allJobs` que é recriado a cada render).
  const allJobIds = useMemo(
    () => (data?.pages.flatMap((page) => page.data) ?? []).map((j) => j.id),
    [data],
  );
  const totalJobs = data?.pages[0]?.pagination.total ?? 0;
  const matchesTotal = matchResults?.total ?? 0;
  const matchesShown = matchResults?.data.length ?? 0;
  const totalPages = data?.pages[0]?.pagination.totalPages ?? 0;
  const currentPage = data?.pages.length ?? 0;

  // Ao voltar do detalhe, a URL traz quantas páginas estavam carregadas.
  // Reabastece o infinite query até esse ponto, em vez de mostrar só a 1ª.
  useEffect(() => {
    if (!data) return;
    if (data.pages.length < targetPage.current && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [data, isFetchingNextPage, fetchNextPage]);

  const visiblePage = Math.max(currentPage, targetPage.current);

  // Espelha o estado dos filtros na URL. `replace` evita encher o histórico a
  // cada tecla digitada na busca.
  useEffect(() => {
    const next = new URLSearchParams();
    if (filters.search) next.set('search', filters.search);
    if (filters.remote) next.set('remote', filters.remote);
    if (filters.seniority) next.set('seniority', filters.seniority);
    if (filters.status) next.set('status', filters.status);
    if (filters.minScore) next.set('minScore', String(filters.minScore));
    if (filters.minSalary != null) next.set('minSalary', String(filters.minSalary));
    if (filters.maxSalary != null) next.set('maxSalary', String(filters.maxSalary));
    if (filters.minConfidence != null) next.set('minConfidence', String(filters.minConfidence));
    if (filters.skill) next.set('skill', filters.skill);
    if (filters.sortBy !== 'date') next.set('sortBy', filters.sortBy);
    if (filters.discarded !== 'active') next.set('discarded', filters.discarded);
    if (visiblePage > 1) next.set('page', String(visiblePage));
    setSearchParams(next, { replace: true });
  }, [filters, visiblePage, setSearchParams]);

  function updateFilters(patch: Partial<Filters>) {
    // Qualquer mudança de filtro reinicia a paginação.
    targetPage.current = 1;
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  const matchResultsMap = useMemo(() => {
    const map = new Map<string, MatchResult>();
    matchResults?.data.forEach((r) => map.set(r.job.id, r));
    return map;
  }, [matchResults]);

  const handleTrack = (jobId: string) => {
    createApplication.mutate(jobId);
  };

  const getMatchResult = (jobId: string): MatchResult | undefined => {
    return matchResultsMap.get(jobId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold">
            {filters.discarded === 'discarded' ? 'Descartes' : 'Vagas'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {totalJobs}{' '}
            {filters.discarded === 'discarded' ? 'vaga(s) descartada(s)' : 'vagas encontradas'}
            {matchesTotal > 0 &&
              (matchesTotal > matchesShown
                ? ` · ${matchesShown} de ${matchesTotal} com match`
                : ` · ${matchesTotal} com match`)}
            {isFetching && !isFetchingNextPage && ' · atualizando...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              updateFilters({
                discarded: filters.discarded === 'discarded' ? 'active' : 'discarded',
              })
            }
          >
            {filters.discarded === 'discarded' ? '← Voltar para Vagas' : 'Descartes'}
          </Button>
          {filters.discarded !== 'discarded' && (
            <Button
              size="sm"
              onClick={() => evaluateAll.mutate(allJobIds)}
              disabled={evaluateAll.isPending || allJobIds.length === 0}
            >
              {evaluateAll.isPending ? 'Avaliando...' : `Avaliar todos (${allJobIds.length})`}
            </Button>
          )}
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
                onChange={(e) => updateFilters({ search: e.target.value })}
              />
            </div>
            <Select
              value={filters.remote}
              onValueChange={(value: string) => updateFilters({ remote: value })}
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
              onValueChange={(value: string) => updateFilters({ seniority: value })}
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
              onValueChange={(value: string) => updateFilters({ status: value })}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos status</SelectItem>
                <SelectItem value="RAW">Coletado</SelectItem>
                <SelectItem value="EXTRACTING">Extraindo dados</SelectItem>
                <SelectItem value="MATCHING">Calculando match</SelectItem>
                <SelectItem value="ANALYZING">Analisando</SelectItem>
                <SelectItem value="DONE">Processado</SelectItem>
                <SelectItem value="FAILED">Com erro</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.minScore ? String(filters.minScore) : '0'}
              onValueChange={(value: string) => updateFilters({ minScore: Number(value) })}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Match mínimo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Qualquer match</SelectItem>
                <SelectItem value="90">Match ≥ 90</SelectItem>
                <SelectItem value="80">Match ≥ 80</SelectItem>
                <SelectItem value="70">Match ≥ 70</SelectItem>
                <SelectItem value="60">Match ≥ 60</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.sortBy}
              onValueChange={(value: string) =>
                updateFilters({ sortBy: value as Filters['sortBy'] })
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Ordenar por data</SelectItem>
                <SelectItem value="match">Ordenar por match</SelectItem>
                <SelectItem value="title">Ordenar por título</SelectItem>
                <SelectItem value="salary">Ordenar por salário</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.minConfidence ? String(filters.minConfidence) : '0'}
              onValueChange={(value: string) =>
                updateFilters({ minConfidence: value === '0' ? null : Number(value) })
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Confiança" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Qualquer confiança</SelectItem>
                <SelectItem value="40">Confiança média+ (≥40)</SelectItem>
                <SelectItem value="70">Alta confiança (≥70)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex flex-col gap-1 w-40">
              <label className="text-xs text-muted-foreground">Salário a partir de</label>
              <Input
                type="number"
                placeholder="mín."
                value={filters.minSalary ?? ''}
                onChange={(e) =>
                  updateFilters({
                    minSalary: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-1 w-40">
              <label className="text-xs text-muted-foreground">Salário até</label>
              <Input
                type="number"
                placeholder="máx."
                value={filters.maxSalary ?? ''}
                onChange={(e) =>
                  updateFilters({
                    maxSalary: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {(applicationsError || matchResultsError) && (
        <ErrorState
          compact
          title="Candidaturas/match podem estar desatualizados: uma das consultas falhou."
          onRetry={() => {
            void refetchApplications();
            void refetchMatchResults();
          }}
        />
      )}

      {/* Jobs List */}
      {isError ? (
        <ErrorState
          title="Não foi possível carregar as vagas"
          error={error}
          onRetry={() => void refetch()}
        />
      ) : isLoading ? (
        <JobsSkeleton />
      ) : allJobs.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-12 w-12" />}
          title="Nenhuma vaga encontrada"
          description="Ajuste os filtros ou colete novas vagas."
          actionLabel="Configurar fontes"
          actionHref="/settings"
        />
      ) : (
        <VirtualJobList
          jobs={allJobs}
          getMatchResult={getMatchResult}
          onEvaluate={(id) => evaluateMatch.mutate(id)}
          evaluating={evaluateMatch.isPending}
          onTrack={handleTrack}
          tracking={createApplication.isPending}
          isTracked={(id: string) => trackedJobs.has(id)}
          discardedView={filters.discarded === 'discarded'}
          onDiscard={(id) => discardJob.mutate(id)}
          onRestore={(id) => restoreJob.mutate(id)}
          discarding={discardJob.isPending}
          restoring={restoreJob.isPending}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between py-4">
          <p className="text-sm text-muted-foreground">
            Página {visiblePage} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                targetPage.current = currentPage + 1;
                void fetchNextPage();
              }}
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
  );
}

export function JobsPage() {
  return (
    <ErrorBoundary onRetry={() => window.location.reload()}>
      <JobsPageContent />
    </ErrorBoundary>
  );
}

interface JobCardProps {
  job: Job;
  matchResult?: MatchResult;
  onEvaluate: () => void;
  evaluating: boolean;
  onTrack: () => void;
  tracking: boolean;
  isTracked: boolean;
  discardedView: boolean;
  onDiscard: () => void;
  onRestore: () => void;
  discarding: boolean;
  restoring: boolean;
}

function JobCard({
  job,
  matchResult,
  onEvaluate,
  evaluating,
  onTrack,
  tracking,
  isTracked,
  discardedView,
  onDiscard,
  onRestore,
  discarding,
  restoring,
}: JobCardProps) {
  // O card usa o score da própria vaga (`job.matchScore`), que vem do banco e
  // existe para qualquer vaga — não só as do top 50 de `/match/results`. Antes
  // dependia do `matchResult` da lista e vaga avaliada fora do top 50 parecia
  // "não avaliada". `matchResult` fica como fallback.
  const score = job.matchScore ?? matchResult?.score ?? null;
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <Link
            to={`/jobs/${job.id}`}
            aria-label={`Ver detalhes da vaga ${job.title}`}
            className="flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg hover:underline">{job.title}</h3>
              {score != null && (
                <Badge variant={score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error'}>
                  {score}%
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">{job.company}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {job.location && <Badge variant="default">{job.location}</Badge>}
              <Badge variant="default">
                {REMOTE_MODE_LABELS[job.remote?.toLowerCase() as keyof typeof REMOTE_MODE_LABELS]
                  ?.label ?? job.remote}
              </Badge>
              {job.seniority && job.seniority !== 'UNKNOWN' && (
                <Badge
                  className={`${SENIORITY_COLORS[job.seniority]?.bg ?? 'bg-surface-2'} ${SENIORITY_COLORS[job.seniority]?.text ?? 'text-muted-foreground'}`}
                >
                  {seniorityLabel(job.seniority)}
                </Badge>
              )}
              {job.salaryMin != null || job.salaryMax != null ? (
                <Badge variant="default">
                  {job.salaryMin != null ? formatSalary(job.salaryMin) : '-'}
                  {job.salaryMin != null && job.salaryMax != null ? ' — ' : ''}
                  {job.salaryMax != null ? formatSalary(job.salaryMax) : ''}
                  {job.salaryCurrency ? ` ${job.salaryCurrency}` : ''}
                </Badge>
              ) : (
                <Badge variant="outline">Não informado</Badge>
              )}
              <Badge
                variant={
                  job.confidence >= 70 ? 'success' : job.confidence >= 40 ? 'warning' : 'error'
                }
              >
                Confiança {job.confidence}%
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {job.status === 'RAW' && <Badge variant="primary">Novo</Badge>}
              <Badge variant="default">{sourceName(job.sourceId)}</Badge>
            </div>
          </Link>
          <div className="flex flex-col items-end gap-2">
            {discardedView ? (
              <Button size="sm" variant="outline" onClick={onRestore} disabled={restoring}>
                {restoring ? '...' : 'Restaurar'}
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant={isTracked ? 'secondary' : 'primary'}
                  onClick={onTrack}
                  disabled={tracking || isTracked}
                >
                  {tracking ? '...' : isTracked ? '✓' : '+'}
                </Button>
                <Button size="sm" variant="outline" onClick={onEvaluate} disabled={evaluating}>
                  {evaluating ? '...' : score != null ? `${score}%` : 'Avaliar match'}
                </Button>
              </>
            )}
            {!discardedView && (
              <Button size="sm" variant="outline" asChild>
                <Link to={`/jobs/${job.id}/kit`}>Kit</Link>
              </Button>
            )}
            <Button size="sm" variant="ghost" asChild>
              <a href={job.url} target="_blank" rel="noopener noreferrer">
                Ver vaga →
              </a>
            </Button>
            {!discardedView && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={onDiscard}
                disabled={discarding}
              >
                {discarding ? '...' : 'Descartar'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface VirtualJobListProps {
  jobs: Job[];
  getMatchResult: (id: string) => MatchResult | undefined;
  onEvaluate: (id: string) => void;
  evaluating: boolean;
  onTrack: (id: string) => void;
  tracking: boolean;
  isTracked: (id: string) => boolean;
  discardedView: boolean;
  onDiscard: (id: string) => void;
  onRestore: (id: string) => void;
  discarding: boolean;
  restoring: boolean;
}

const ROW_HEIGHT = 220;

function VirtualJobList({
  jobs,
  getMatchResult,
  onEvaluate,
  evaluating,
  onTrack,
  tracking,
  isTracked,
  discardedView,
  onDiscard,
  onRestore,
  discarding,
  restoring,
}: VirtualJobListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualRowVirtualizer = useVirtualizer({
    count: jobs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="space-y-4 max-h-[60vh] overflow-y-auto">
      <div
        className="h-full"
        style={{
          height: virtualRowVirtualizer.getTotalSize(),
          position: 'relative',
        }}
      >
        {virtualRowVirtualizer.getVirtualItems().map((virtualRow) => {
          const job = jobs[virtualRow.index];
          return (
            <div
              key={job.id}
              className="relative pb-4"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <JobCard
                key={job.id}
                job={job}
                matchResult={getMatchResult(job.id)}
                onEvaluate={() => onEvaluate(job.id)}
                evaluating={evaluating}
                onTrack={() => onTrack(job.id)}
                tracking={tracking}
                isTracked={isTracked(job.id)}
                discardedView={discardedView}
                onDiscard={() => onDiscard(job.id)}
                onRestore={() => onRestore(job.id)}
                discarding={discarding}
                restoring={restoring}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
