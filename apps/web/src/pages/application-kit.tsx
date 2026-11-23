import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ATS_PROVIDERS, matchLabelFor, MATCH_CRITERIA, MATCH_LABELS } from '@job-radar/shared';
import {
  applicationsApi,
  cvApi,
  downloadBlob,
  jobsApi,
  matchApi,
  type ApplicationKit,
  type AttachmentKind,
} from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { ErrorState } from '../components/error-state';
import { ErrorBoundary } from '../components/error-boundary';
import { CoverLetterPanel } from '../components/cover-letter-panel';
import { toast } from '../components/ui/toast';
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  Mail,
  Paperclip,
  Trash2,
} from 'lucide-react';

const STATUS_OPTIONS = [
  { id: 'FOUND', label: 'Encontrada' },
  { id: 'INTERESTING', label: 'Interessante' },
  { id: 'CV_PREPARED', label: 'CV preparado' },
  { id: 'APPLIED', label: 'Aplicada' },
  { id: 'INTERVIEW', label: 'Entrevista' },
  { id: 'REJECTED', label: 'Rejeitada' },
  { id: 'OFFER', label: 'Oferta' },
  { id: 'ARCHIVED', label: 'Arquivada' },
] as const;

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((option) => [option.id, option.label]),
);

const KIND_OPTIONS: Array<{ id: AttachmentKind; label: string }> = [
  { id: 'cover_letter', label: 'Carta' },
  { id: 'portfolio', label: 'Portfólio' },
  { id: 'other', label: 'Outro' },
];

const KIND_LABELS: Record<AttachmentKind, string> = {
  cover_letter: 'Carta',
  portfolio: 'Portfólio',
  other: 'Outro',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function toDateTimeLocal(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/**
 * Bloco do kit com estado próprio.
 *
 * O `ErrorState` e o skeleton ficam DENTRO do card: uma falha no match não
 * apaga a candidatura, a carta ou os anexos — que é o defeito que o kit existe
 * para corrigir (uma tela, sem perder o resto por causa de uma chamada).
 */
export function KitBlock({
  title,
  id,
  isLoading,
  isError,
  error,
  onRetry,
  actions,
  children,
}: {
  title: string;
  id?: string;
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card id={id}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        {actions}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2" aria-label={`Carregando ${title}`}>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : isError ? (
          <ErrorState
            compact
            title={`Não foi possível carregar ${title.toLowerCase()}`}
            error={error}
            onRetry={onRetry}
          />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export function ApplicationKitPage() {
  return (
    <ErrorBoundary onRetry={() => window.location.reload()}>
      <ApplicationKitContent />
    </ErrorBoundary>
  );
}

function ApplicationKitContent() {
  const { id: jobId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  // Três consultas independentes: a vaga (cabeçalho), a candidatura e o kit.
  const jobQuery = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => jobsApi.getById(jobId!),
    enabled: !!jobId,
  });

  const applicationQuery = useQuery({
    queryKey: ['application-for-job', jobId],
    queryFn: () => applicationsApi.getList({ jobId, limit: 1 }),
    enabled: !!jobId,
  });

  const application = applicationQuery.data?.data.find((a) => a.job.id === jobId) ?? null;
  const applicationId = application?.id;

  const kitQuery = useQuery({
    queryKey: ['application-kit', applicationId],
    queryFn: () => applicationsApi.getKit(applicationId!),
    enabled: !!applicationId,
  });

  const createApplication = useMutation({
    mutationFn: () => applicationsApi.create(jobId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application-for-job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast.success('Candidatura criada');
    },
    onError: () => toast.error('Não foi possível criar a candidatura'),
  });

  const job = kitQuery.data?.application.job ?? jobQuery.data;
  const status = kitQuery.data?.application.status;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to={`/jobs/${jobId}`}
            className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para a vaga
          </Link>
          <h1 className="text-2xl font-bold">{job?.title ?? 'Kit da candidatura'}</h1>
          <p className="text-muted-foreground">{job?.company}</p>
        </div>
        {status && <Badge variant="outline">Status: {STATUS_LABELS[status] ?? status}</Badge>}
      </div>

      {applicationQuery.isError && (
        <ErrorState
          title="Não foi possível verificar se a vaga já tem candidatura"
          error={applicationQuery.error}
          onRetry={() => void applicationQuery.refetch()}
        />
      )}

      {!applicationQuery.isLoading && !applicationQuery.isError && !application && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <p className="text-sm text-muted-foreground">
              Esta vaga ainda não tem candidatura. Crie uma para montar o kit (status, artefatos,
              anexos e export).
            </p>
            <Button
              onClick={() => createApplication.mutate()}
              disabled={createApplication.isPending}
            >
              {createApplication.isPending ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Criando...
                </>
              ) : (
                'Criar candidatura'
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {applicationId && (
        <>
          <ApplicationBlock
            applicationId={applicationId}
            kit={kitQuery.data}
            isLoading={kitQuery.isLoading}
            isError={kitQuery.isError}
            error={kitQuery.error}
            onRetry={() => void kitQuery.refetch()}
          />

          <MatchBlock
            jobId={jobId!}
            applicationId={applicationId}
            kit={kitQuery.data}
            isLoading={kitQuery.isLoading}
            isError={kitQuery.isError}
            error={kitQuery.error}
            onRetry={() => void kitQuery.refetch()}
          />

          <KeywordGapBlock jobId={jobId!} />

          <CvBlock
            jobId={jobId!}
            kit={kitQuery.data}
            isLoading={kitQuery.isLoading}
            isError={kitQuery.isError}
            error={kitQuery.error}
            onRetry={() => void kitQuery.refetch()}
          />

          <CoverLetterPanel jobId={jobId!} company={job?.company} />

          <AttachmentsBlock applicationId={applicationId} />

          <ExportBlock applicationId={applicationId} company={job?.company} />

          <HistoryBlock
            kit={kitQuery.data}
            isLoading={kitQuery.isLoading}
            isError={kitQuery.isError}
            error={kitQuery.error}
            onRetry={() => void kitQuery.refetch()}
          />
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Candidatura: status, follow-up, ATS e contato                              */
/* -------------------------------------------------------------------------- */

function ApplicationBlock({
  applicationId,
  kit,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  applicationId: string;
  kit?: ApplicationKit;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [ats, setAts] = useState('none');
  const [recruiter, setRecruiter] = useState('');
  const [recruiterEmail, setRecruiterEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [salary, setSalary] = useState('');
  const [contactNote, setContactNote] = useState('');

  const app = kit?.application;
  const updatedAt = app?.updatedAt;

  // Sincroniza só quando a candidatura muda de verdade: sem isso, cada
  // revalidação do kit sobrescreveria o que o usuário está digitando.
  useEffect(() => {
    if (!app) return;
    const contacts = (app.contacts ?? {}) as Record<string, unknown>;
    setStatus(app.status);
    setFollowUp(toDateTimeLocal(app.followUpAt));
    setAts(app.atsUsed ?? 'none');
    setRecruiter(typeof contacts.recruiter === 'string' ? contacts.recruiter : '');
    setRecruiterEmail(typeof contacts.recruiterEmail === 'string' ? contacts.recruiterEmail : '');
    setNotes(app.notes ?? '');
    setSalary(app.salary != null ? String(app.salary) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app?.id, updatedAt]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['application-kit', applicationId] });
    queryClient.invalidateQueries({ queryKey: ['applications'] });
    queryClient.invalidateQueries({ queryKey: ['application-for-job', app?.job.id] });
  };

  const updateStatus = useMutation({
    mutationFn: (next: string) => applicationsApi.updateStatus(applicationId, next),
    onSuccess: (_, next) => {
      invalidate();
      toast.success(`Status: ${STATUS_LABELS[next] ?? next}`);
    },
    onError: () => toast.error('Não foi possível mudar o status'),
  });

  const updateFollowUp = useMutation({
    mutationFn: (value: string | null) => applicationsApi.updateFollowUp(applicationId, value),
    onSuccess: () => {
      invalidate();
      toast.success('Follow-up atualizado');
    },
    onError: () => toast.error('Não foi possível salvar o follow-up'),
  });

  const save = useMutation({
    mutationFn: () =>
      applicationsApi.update(applicationId, {
        atsUsed: ats === 'none' ? null : ats,
        notes: notes.trim() || undefined,
        salary: salary.trim() ? Number(salary) : null,
        contacts: {
          ...(recruiter.trim() ? { recruiter: recruiter.trim() } : {}),
          ...(recruiterEmail.trim() ? { recruiterEmail: recruiterEmail.trim() } : {}),
        },
      }),
    onSuccess: () => {
      invalidate();
      toast.success('Candidatura atualizada');
    },
    onError: () => toast.error('Não foi possível salvar a candidatura'),
  });

  const registerContact = useMutation({
    mutationFn: () =>
      applicationsApi.registerContact(applicationId, contactNote.trim() || undefined),
    onSuccess: () => {
      setContactNote('');
      invalidate();
      toast.success('Contato registrado. Follow-up reagendado.');
    },
    onError: () => toast.error('Não foi possível registrar o contato'),
  });

  return (
    <KitBlock
      title="Candidatura"
      id="kit-candidatura"
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={onRetry}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="kit-status" className="text-xs text-muted-foreground">
            Status
          </label>
          <Select
            value={status || undefined}
            onValueChange={(next) => {
              setStatus(next);
              updateStatus.mutate(next);
            }}
          >
            <SelectTrigger id="kit-status" aria-label="Status da candidatura">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {status !== 'APPLIED' && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => updateStatus.mutate('APPLIED')}
              disabled={updateStatus.isPending}
            >
              Marcar como aplicada
            </Button>
          )}
        </div>

        <div>
          <label htmlFor="kit-follow-up" className="text-xs text-muted-foreground">
            Follow-up
          </label>
          <div className="flex gap-2">
            <Input
              id="kit-follow-up"
              type="datetime-local"
              value={followUp}
              onChange={(event) => setFollowUp(event.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                updateFollowUp.mutate(followUp ? new Date(followUp).toISOString() : null)
              }
              disabled={updateFollowUp.isPending}
            >
              Salvar
            </Button>
            {followUp && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFollowUp('');
                  updateFollowUp.mutate(null);
                }}
              >
                Limpar
              </Button>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="kit-ats" className="text-xs text-muted-foreground">
            ATS usado
          </label>
          <Select value={ats} onValueChange={setAts}>
            <SelectTrigger id="kit-ats" aria-label="ATS usado na candidatura">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Não informado</SelectItem>
              {ATS_PROVIDERS.map((provider) => (
                <SelectItem key={provider} value={provider}>
                  {provider}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label htmlFor="kit-salary" className="text-xs text-muted-foreground">
            Pretensão/oferta (R$)
          </label>
          <Input
            id="kit-salary"
            type="number"
            min={0}
            inputMode="numeric"
            value={salary}
            onChange={(event) => setSalary(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="kit-recruiter" className="text-xs text-muted-foreground">
            Recrutador
          </label>
          <Input
            id="kit-recruiter"
            value={recruiter}
            onChange={(event) => setRecruiter(event.target.value)}
            placeholder="Nome de quem responde"
            maxLength={200}
          />
        </div>

        <div>
          <label htmlFor="kit-recruiter-email" className="text-xs text-muted-foreground">
            E-mail do recrutador
          </label>
          <Input
            id="kit-recruiter-email"
            type="email"
            value={recruiterEmail}
            onChange={(event) => setRecruiterEmail(event.target.value)}
            placeholder="contato@empresa.com"
            maxLength={200}
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="kit-notes" className="text-xs text-muted-foreground">
            Anotações
          </label>
          <textarea
            id="kit-notes"
            className="min-h-20 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={5000}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Aplicada em {formatDate(app?.appliedAt)} · Atualizada em {formatDate(updatedAt)}
        </span>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Nota do contato (opcional)"
            value={contactNote}
            onChange={(event) => setContactNote(event.target.value)}
            maxLength={1000}
            className="w-48"
          />
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
          <Button onClick={() => registerContact.mutate()} disabled={registerContact.isPending}>
            {registerContact.isPending ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              </>
            ) : (
              <Mail className="h-4 w-4 mr-1" />
            )}
            Registrei contato
          </Button>
        </div>
      </div>
    </KitBlock>
  );
}

/* -------------------------------------------------------------------------- */
/* Match                                                                      */
/* -------------------------------------------------------------------------- */

function MatchBlock({
  jobId,
  applicationId,
  kit,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  jobId: string;
  applicationId: string;
  kit?: ApplicationKit;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const queryClient = useQueryClient();
  const matchQuery = useQuery({
    queryKey: ['match-result', jobId],
    queryFn: () => matchApi.getForJob(jobId),
  });

  const evaluate = useMutation({
    mutationFn: () => matchApi.evaluate(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-result', jobId] });
      queryClient.invalidateQueries({ queryKey: ['application-kit', applicationId] });
    },
    onError: () => toast.error('Não foi possível avaliar o match'),
  });

  const stored = kit?.match;
  const match = matchQuery.data?.match ?? null;
  const score = stored?.score ?? match?.score;
  const breakdown = stored?.breakdown ?? match?.breakdown;

  return (
    <KitBlock
      title="Match com a vaga"
      id="kit-match"
      isLoading={isLoading || matchQuery.isLoading}
      isError={isError || matchQuery.isError}
      error={error ?? matchQuery.error}
      onRetry={() => {
        onRetry();
        void matchQuery.refetch();
      }}
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={() => evaluate.mutate()}
          disabled={evaluate.isPending}
        >
          {evaluate.isPending ? 'Avaliando...' : score == null ? 'Avaliar' : 'Reavaliar'}
        </Button>
      }
    >
      {score == null ? (
        <p className="text-sm text-muted-foreground">Esta vaga ainda não foi avaliada.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{score}%</span>
            <Badge variant="outline">{MATCH_LABELS[matchLabelFor(score)].label}</Badge>
          </div>
          {breakdown && (
            <div className="grid gap-2 sm:grid-cols-3">
              {MATCH_CRITERIA.map((criterion) => (
                <div key={criterion} className="rounded bg-surface-2 p-2">
                  <div className="text-xs capitalize text-muted-foreground">{criterion}</div>
                  <div className="font-medium">{breakdown[criterion]}%</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </KitBlock>
  );
}

/* -------------------------------------------------------------------------- */
/* Keyword gap                                                                */
/* -------------------------------------------------------------------------- */

function KeywordGapBlock({ jobId }: { jobId: string }) {
  const gapQuery = useQuery({
    queryKey: ['keyword-gap', jobId],
    queryFn: () => jobsApi.keywordGap(jobId),
  });

  const gap = gapQuery.data;

  return (
    <KitBlock
      title="Keywords faltantes"
      id="kit-keywords"
      isLoading={gapQuery.isLoading}
      isError={gapQuery.isError}
      error={gapQuery.error}
      onRetry={() => void gapQuery.refetch()}
    >
      {!gap || gap.gaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem skills estruturadas para comparar.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{gap.recommendation}</p>
          <div className="flex flex-wrap gap-2">
            {gap.gaps.map((item) => (
              <Badge
                key={item.keyword}
                variant={
                  item.status === 'missing'
                    ? 'error'
                    : item.status === 'partial'
                      ? 'warning'
                      : 'success'
                }
              >
                {item.keyword}
                {item.status !== 'matched' && ` (${item.status})`}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </KitBlock>
  );
}

/* -------------------------------------------------------------------------- */
/* CV otimizado                                                               */
/* -------------------------------------------------------------------------- */

function CvBlock({
  jobId,
  kit,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  jobId: string;
  kit?: ApplicationKit;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const optimize = useMutation({
    mutationFn: () => cvApi.optimize({ jobId }),
    onSuccess: () => toast.success('CV otimizado'),
    onError: () => toast.error('Não foi possível otimizar o CV'),
  });

  const pdf = useMutation({
    mutationFn: (optimizedText: string) => cvApi.exportPdf({ jobId, optimizedText }),
    onSuccess: (blob) => {
      downloadBlob(blob, 'cv-otimizado.pdf');
      toast.success('PDF gerado');
    },
    onError: () => toast.error('Não foi possível gerar o PDF'),
  });

  const versions = kit?.cvVersions ?? [];

  return (
    <KitBlock
      title="CV otimizado"
      id="kit-cv"
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={onRetry}
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={() => optimize.mutate()}
          disabled={optimize.isPending}
        >
          {optimize.isPending ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Otimizando...
            </>
          ) : (
            'Otimizar CV para esta vaga'
          )}
        </Button>
      }
    >
      {optimize.isError && (
        <p className="mb-2 text-sm text-error" role="alert">
          Não foi possível otimizar o CV. Tente novamente.
        </p>
      )}

      {optimize.data && (
        <div className="mb-3 space-y-2">
          {optimize.data.warning && (
            <p className="flex items-start gap-2 rounded border border-error/40 bg-error/10 p-2 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" aria-hidden />
              {optimize.data.warning}
            </p>
          )}
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-surface-2 p-2 text-xs">
            {optimize.data.optimizedText}
          </pre>
          <Button
            size="sm"
            variant="outline"
            onClick={() => pdf.mutate(optimize.data.optimizedText)}
            disabled={pdf.isPending}
          >
            <Download className="mr-1 h-4 w-4" /> Baixar PDF
          </Button>
        </div>
      )}

      {versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma versão de CV gerada para esta vaga ainda.
        </p>
      ) : (
        <ul className="space-y-1 text-sm">
          {versions.map((version) => (
            <li key={version.id} className="flex items-center gap-2 text-muted-foreground">
              <FileText className="h-4 w-4" />
              {version.filename ?? 'CV otimizado'} · {formatDate(version.generatedAt)}
            </li>
          ))}
        </ul>
      )}
    </KitBlock>
  );
}

/* -------------------------------------------------------------------------- */
/* Anexos                                                                     */
/* -------------------------------------------------------------------------- */

function AttachmentsBlock({ applicationId }: { applicationId: string }) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<AttachmentKind>('cover_letter');

  const attachmentsQuery = useQuery({
    queryKey: ['application-attachments', applicationId],
    queryFn: () => applicationsApi.listAttachments(applicationId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['application-attachments', applicationId] });

  const upload = useMutation({
    mutationFn: (file: File) => applicationsApi.uploadAttachment(applicationId, file, kind),
    onSuccess: () => {
      invalidate();
      toast.success('Anexo enviado');
    },
    onError: () => toast.error('Não foi possível enviar o anexo'),
  });

  const remove = useMutation({
    mutationFn: (attachmentId: string) =>
      applicationsApi.deleteAttachment(applicationId, attachmentId),
    onSuccess: () => {
      invalidate();
      toast.success('Anexo removido');
    },
    onError: () => toast.error('Não foi possível remover o anexo'),
  });

  const download = useMutation({
    mutationFn: (attachmentId: string) => {
      const attachment = attachmentsQuery.data?.find((item) => item.id === attachmentId);
      if (!attachment) throw new Error('Anexo não encontrado');
      return applicationsApi.downloadAttachment(attachment);
    },
    onSuccess: (blob, attachmentId) => {
      const attachment = attachmentsQuery.data?.find((item) => item.id === attachmentId);
      downloadBlob(blob, attachment?.originalName ?? 'anexo');
    },
    onError: () => toast.error('Não foi possível baixar o anexo'),
  });

  const attachments = attachmentsQuery.data ?? [];

  return (
    <KitBlock
      title="Anexos"
      id="kit-anexos"
      isLoading={attachmentsQuery.isLoading}
      isError={attachmentsQuery.isError}
      error={attachmentsQuery.error}
      onRetry={() => void attachmentsQuery.refetch()}
    >
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="kit-attachment-kind" className="text-xs text-muted-foreground">
            Tipo
          </label>
          <Select value={kind} onValueChange={(value) => setKind(value as AttachmentKind)}>
            <SelectTrigger id="kit-attachment-kind" aria-label="Tipo do anexo" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="kit-attachment-file" className="text-xs text-muted-foreground">
            Arquivo (PDF, DOCX, TXT, PNG, JPEG — até 10 MB)
          </label>
          <Input
            id="kit-attachment-file"
            type="file"
            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
              event.target.value = '';
            }}
            disabled={upload.isPending}
          />
        </div>
        {upload.isPending && (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
          </span>
        )}
      </div>

      {upload.isError && (
        <p className="mb-2 text-sm text-error" role="alert">
          Não foi possível enviar. Verifique o tipo e o tamanho do arquivo.
        </p>
      )}

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum anexo nesta candidatura.</p>
      ) : (
        <ul className="divide-y divide-border">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">{attachment.originalName}</div>
                  <div className="text-xs text-muted-foreground">
                    {KIND_LABELS[attachment.kind]} · {formatBytes(attachment.size)} ·{' '}
                    {formatDate(attachment.createdAt)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => download.mutate(attachment.id)}
                  disabled={download.isPending}
                  aria-label={`Baixar ${attachment.originalName}`}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove.mutate(attachment.id)}
                  disabled={remove.isPending}
                  aria-label={`Remover ${attachment.originalName}`}
                >
                  <Trash2 className="h-4 w-4 text-error" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </KitBlock>
  );
}

/* -------------------------------------------------------------------------- */
/* Export                                                                     */
/* -------------------------------------------------------------------------- */

function ExportBlock({ applicationId, company }: { applicationId: string; company?: string }) {
  const exportMutation = useMutation({
    mutationFn: (format: 'json' | 'csv') => applicationsApi.exportKit(applicationId, format),
    onSuccess: (blob, format) => {
      const base = (company ?? 'vaga')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .toLowerCase();
      downloadBlob(blob, `kit-${base}.${format}`);
    },
    onError: () => toast.error('Não foi possível exportar'),
  });

  return (
    <KitBlock title="Exportar" id="kit-export">
      <p className="mb-3 text-sm text-muted-foreground">
        O JSON leva todos os campos do kit (histórico, anexos, match e análise); o CSV é a visão
        tabular para planilha.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => exportMutation.mutate('json')}
          disabled={exportMutation.isPending}
        >
          <Download className="mr-1 h-4 w-4" /> Exportar JSON
        </Button>
        <Button
          variant="outline"
          onClick={() => exportMutation.mutate('csv')}
          disabled={exportMutation.isPending}
        >
          <Download className="mr-1 h-4 w-4" /> Exportar CSV
        </Button>
      </div>
    </KitBlock>
  );
}

/* -------------------------------------------------------------------------- */
/* Histórico                                                                  */
/* -------------------------------------------------------------------------- */

function HistoryBlock({
  kit,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  kit?: ApplicationKit;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const events = kit?.application.events ?? [];

  return (
    <KitBlock
      title="Histórico"
      id="kit-historico"
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={onRetry}
    >
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
      ) : (
        <ol className="space-y-2">
          {events.map((event) => (
            <li key={event.id} className="flex items-start gap-2 text-sm">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
              <div>
                <span className="font-medium">
                  {event.fromStatus
                    ? `${STATUS_LABELS[event.fromStatus] ?? event.fromStatus} → `
                    : ''}
                  {STATUS_LABELS[event.toStatus] ?? event.toStatus}
                </span>
                <span className="text-muted-foreground"> · {formatDate(event.createdAt)}</span>
                {event.note && <div className="text-xs text-muted-foreground">{event.note}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </KitBlock>
  );
}
