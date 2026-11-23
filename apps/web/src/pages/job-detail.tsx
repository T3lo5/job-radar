import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi, matchApi, cvApi, applicationsApi, downloadBlob } from '../services/api';
import { sanitizeHtml } from '../lib/sanitize';
import { formatSalary } from '../lib/salary';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/empty-state';
import { ErrorState } from '../components/error-state';
import { ErrorBoundary } from '../components/error-boundary';
import { toast } from '../components/ui/toast';
import {
  matchLabelFor,
  MATCH_CRITERIA,
  MATCH_LABELS,
  REMOTE_MODE_LABELS,
  SKILL_MATCH_REASON_LABELS,
  APPLICATION_STATUS_LABELS,
} from '@job-radar/shared';
import {
  ExternalLink,
  FileText,
  Download,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { CoverLetterPanel } from '../components/cover-letter-panel';

function JobDetailContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // `location.key === 'default'` significa que a página foi aberta direto
  // (link externo/refresh), sem histórico interno para voltar.
  const canGoBack = location.key !== 'default';

  const {
    data: job,
    isLoading: jobLoading,
    isError: jobError,
    error: jobErrorObj,
    refetch: refetchJob,
  } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobsApi.getById(id!),
    enabled: !!id,
  });

  const {
    data: matchResult,
    isError: matchError,
    refetch: refetchMatch,
  } = useQuery({
    queryKey: ['match-result', id],
    // Endpoint por vaga: a lista tem top 50 e uma vaga fora dele aparecia
    // como "não avaliada".
    queryFn: () => matchApi.getForJob(id!),
    enabled: !!id,
  });

  // Candidatura desta vaga, se já existir. É o que permite refletir o estado
  // no lugar de recriar a candidatura a cada clique (409) — e o que fazia os
  // botões "Marcar como aplicada"/"Arquivar" ficarem mortos antes.
  const {
    data: jobApplications,
    isError: jobApplicationsError,
    refetch: refetchJobApplications,
  } = useQuery({
    queryKey: ['application-for-job', id],
    queryFn: () => applicationsApi.getList({ jobId: id, limit: 1 }),
    enabled: !!id,
  });

  const application = jobApplications?.data.find((a) => a.job.id === id) ?? null;

  function invalidateApplicationQueries() {
    queryClient.invalidateQueries({ queryKey: ['applications'] });
    queryClient.invalidateQueries({ queryKey: ['application-for-job', id] });
    queryClient.invalidateQueries({ queryKey: ['match-result', id] });
  }

  /**
   * Garante que existe candidatura para a vaga e devolve o id.
   *
   * O POST devolve 409 quando outra aba/duplo clique já criou — nesse caso o
   * id vem no corpo e seguimos com a atualização em vez de mostrar erro.
   */
  async function ensureApplicationId(): Promise<string> {
    try {
      const { applicationId } = await applicationsApi.create(id!);
      return applicationId;
    } catch (err) {
      const response = (
        err as { response?: { status?: number; data?: { applicationId?: string } } }
      ).response;
      if (response?.status === 409 && response.data?.applicationId) {
        return response.data.applicationId;
      }
      throw err;
    }
  }

  const markAppliedMutation = useMutation({
    mutationFn: async () => {
      const applicationId = application?.id ?? (await ensureApplicationId());
      return applicationsApi.updateStatus(applicationId, 'APPLIED');
    },
    onSuccess: () => {
      invalidateApplicationQueries();
      toast.success('Candidatura marcada como aplicada');
    },
    onError: () => toast.error('Não foi possível marcar a candidatura como aplicada'),
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const applicationId = application?.id ?? (await ensureApplicationId());
      return applicationsApi.updateStatus(applicationId, 'ARCHIVED');
    },
    onSuccess: () => {
      invalidateApplicationQueries();
      toast.success('Candidatura arquivada');
    },
    onError: () => toast.error('Não foi possível arquivar a candidatura'),
  });

  const keywordGapQuery = useQuery({
    queryKey: ['keyword-gap', id],
    queryFn: () => jobsApi.keywordGap(id!),
    enabled: !!id,
  });

  const keywordGap = keywordGapQuery.data;

  const evaluateMutation = useMutation({
    mutationFn: () => matchApi.evaluate(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-result', id] });
      // O dashboard e a lista usam os agregados; sem isto o score novo só
      // apareceria no próximo refetch (5 min).
      queryClient.invalidateQueries({ queryKey: ['match-stats'] });
      queryClient.invalidateQueries({ queryKey: ['match-results'] });
      toast.success('Match avaliado com sucesso');
    },
    onError: () => toast.error('Erro ao avaliar match'),
  });

  const optimizeCvMutation = useMutation({
    mutationFn: () =>
      cvApi.optimize({
        jobId: id,
      }),
    onSuccess: () => {
      toast.success('CV otimizado com sucesso!');
    },
    onError: () => toast.error('Erro ao otimizar CV'),
  });

  const exportPdfMutation = useMutation({
    mutationFn: () =>
      cvApi.exportPdf({
        jobId: id,
        optimizedText: optimizeCvMutation.data?.optimizedText,
      }),
    onSuccess: (blob) => {
      downloadBlob(blob, `cv-${job?.company ?? 'vaga'}.pdf`);
      toast.success('PDF gerado com sucesso!');
    },
    onError: () => toast.error('Erro ao gerar PDF'),
  });

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
    );
  }

  if (jobError) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/jobs')}>
          ← Voltar para vagas
        </Button>
        <ErrorState
          title="Não foi possível carregar a vaga"
          error={jobErrorObj}
          onRetry={() => void refetchJob()}
        />
      </div>
    );
  }

  if (!job) {
    return (
      <EmptyState
        title="Vaga não encontrada"
        description="A vaga que você está procurando não existe ou foi removida."
        action={<Button onClick={() => navigate('/jobs')}>Ver todas as vagas</Button>}
      />
    );
  }

  const match = matchResult?.match ?? null;

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => (canGoBack ? navigate(-1) : navigate('/jobs'))}
      >
        ← Voltar para vagas
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
                  <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
                    {job.location}
                  </span>
                )}
                <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
                  {REMOTE_MODE_LABELS[job.remote?.toLowerCase() as keyof typeof REMOTE_MODE_LABELS]
                    ?.label ?? job.remote}
                </span>
                {job.salaryMin != null || job.salaryMax != null ? (
                  <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
                    {job.salaryMin != null ? formatSalary(job.salaryMin) : '-'}
                    {job.salaryMin != null && job.salaryMax != null ? ' — ' : ''}
                    {job.salaryMax != null ? formatSalary(job.salaryMax) : ''}
                    {job.salaryCurrency ? ` ${job.salaryCurrency}` : ''}
                  </span>
                ) : (
                  <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
                    Não informado
                  </span>
                )}
                <span
                  className={`rounded bg-surface-2 px-2 py-0.5 text-xs font-medium ${
                    job.confidence >= 70
                      ? 'text-success'
                      : job.confidence >= 40
                        ? 'text-warning'
                        : 'text-error'
                  }`}
                >
                  Confiança {job.confidenceLabel} ({job.confidence})%
                </span>
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
              <>
                <div className="mt-4 grid gap-2 md:grid-cols-4">
                  {MATCH_CRITERIA.map((criterion) => (
                    <div key={criterion} className="rounded bg-surface-2 p-2">
                      <div className="text-xs text-muted-foreground capitalize">{criterion}</div>
                      <div className="font-medium">{match.breakdown[criterion]}%</div>
                    </div>
                  ))}
                </div>
                {match.breakdown.skillEvidence && match.breakdown.skillEvidence.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs text-muted-foreground">Por que as skills casaram</div>
                    <ul className="mt-1 flex flex-wrap gap-2">
                      {match.breakdown.skillEvidence.map((evidence) => (
                        <li
                          key={`${evidence.skill}-${evidence.reason}`}
                          className="rounded bg-surface-2 px-2 py-1 text-xs"
                        >
                          <span className="font-medium">{evidence.skill}</span>{' '}
                          <span className="text-muted-foreground">
                            {SKILL_MATCH_REASON_LABELS[evidence.reason]}
                            {evidence.via ? ` (${evidence.via})` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : matchError ? (
        <ErrorState
          compact
          title="Não foi possível carregar o match desta vaga"
          onRetry={() => void refetchMatch()}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">Esta vaga ainda não foi avaliada.</p>
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

      {/* Sinais de confiança */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Sinais de confiança
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Índice de confiança</span>
            <Badge
              variant={
                job.confidence >= 70 ? 'success' : job.confidence >= 40 ? 'warning' : 'error'
              }
            >
              {job.confidenceLabel} ({job.confidence})%
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {job.confidenceBadges.map((badge) => (
              <Badge key={badge.type} variant="outline" title={badge.description}>
                {badge.label}
              </Badge>
            ))}
          </div>
          {job.confidenceBadges.length === 0 && (
            <p className="text-xs text-muted-foreground">Sem sinais de confiança disponíveis.</p>
          )}
        </CardContent>
      </Card>

      {/* Keyword Gap Analysis */}
      {keywordGapQuery.isError && (
        <ErrorState
          compact
          title="Não foi possível carregar a análise de keywords"
          onRetry={() => void keywordGapQuery.refetch()}
        />
      )}
      {keywordGap && keywordGap.gaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Análise de Keywords</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  {keywordGap.matched.length} conferidas
                </span>
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  {keywordGap.partial.length} parciais
                </span>
                <span className="flex items-center gap-1">
                  <XCircle className="h-4 w-4 text-error" />
                  {keywordGap.missing.length} ausentes
                </span>
              </div>
              <div className="space-y-2">
                {keywordGap.gaps.map((g) => (
                  <div
                    key={g.keyword}
                    className="flex items-start justify-between rounded bg-surface-2 p-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{g.keyword}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {g.category === 'required' ? 'Obrigatório' : 'Desejável'}
                      </span>
                      {g.suggestion && (
                        <p className="mt-1 text-xs text-muted-foreground">{g.suggestion}</p>
                      )}
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        g.status === 'matched'
                          ? 'bg-success/10 text-success'
                          : g.status === 'partial'
                            ? 'bg-warning/10 text-warning'
                            : 'bg-error/10 text-error'
                      }`}
                    >
                      {g.status === 'matched'
                        ? 'OK'
                        : g.status === 'partial'
                          ? 'Parcial'
                          : 'Ausente'}
                    </span>
                  </div>
                ))}
              </div>
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
          <div
            className="whitespace-pre-wrap text-sm"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.description) }}
          />
        </CardContent>
      </Card>

      {/* Application Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações</CardTitle>
        </CardHeader>
        <CardContent>
          {jobApplicationsError && (
            <ErrorState
              compact
              title="Não foi possível carregar o status da candidatura"
              onRetry={() => void refetchJobApplications()}
              className="mb-3"
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {application && (
              <Badge variant="outline" className="mr-2">
                Status:{' '}
                {APPLICATION_STATUS_LABELS[
                  application.status as keyof typeof APPLICATION_STATUS_LABELS
                ] ?? application.status}
              </Badge>
            )}
            <Button
              onClick={() => markAppliedMutation.mutate()}
              disabled={markAppliedMutation.isPending || application?.status === 'APPLIED'}
            >
              {markAppliedMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  {application?.status === 'APPLIED' ? 'Já aplicada' : 'Marcar como aplicada'}
                </>
              )}
            </Button>
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
            <Button variant="outline" asChild>
              <Link to={`/jobs/${id}/kit`}>
                <FileText className="h-4 w-4 mr-1" />
                Abrir kit
              </Link>
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
            <Button
              variant="outline"
              onClick={() => {
                if (application?.status === 'ARCHIVED') return;
                if (
                  window.confirm('Arquivar esta candidatura? Ela sai da lista ativa do Kanban.')
                ) {
                  archiveMutation.mutate();
                }
              }}
              disabled={archiveMutation.isPending || application?.status === 'ARCHIVED'}
            >
              {archiveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Arquivando...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-1" />
                  {application?.status === 'ARCHIVED' ? 'Arquivada' : 'Arquivar'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cover Letter */}
      <CoverLetterPanel jobId={id!} company={job.company ?? undefined} />
    </div>
  );
}

export function JobDetailPage() {
  return (
    <ErrorBoundary onRetry={() => window.location.reload()}>
      <JobDetailContent />
    </ErrorBoundary>
  );
}
