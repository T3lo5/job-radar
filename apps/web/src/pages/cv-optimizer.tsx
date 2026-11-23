import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { applicationsApi, cvApi, downloadBlob, profileApi } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/empty-state';
import { ErrorState } from '../components/error-state';
import { toast } from '../components/ui/toast';
import { FileText, Download, Loader2, Briefcase } from 'lucide-react';

type OptimizationMode = 'job' | 'manual';

type Application = {
  id: string;
  status: string;
  job: {
    id: string;
    title: string;
    company: string;
    location: string | null;
  };
};

type OptimizedResult = {
  optimizedText: string;
  originalText: string;
  changes: Array<{ type: string; section: string; description: string }>;
  keywordsAdded: string[];
  keywordsDropped: string[];
  keywordEvidence: Array<{ term: string; matchedAlias?: string; sourceIndex?: number }>;
  summary: string;
  warning?: string;
};

export function CvOptimizerPage() {
  const [mode, setMode] = useState<OptimizationMode>('job');
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [manualJobDescription, setManualJobDescription] = useState('');
  const [optimizedResult, setOptimizedResult] = useState<OptimizedResult | null>(null);

  const {
    data: applicationsData,
    isLoading: applicationsLoading,
    isError: applicationsError,
    error: applicationsErrorObj,
    refetch: refetchApplications,
  } = useQuery({
    queryKey: ['applications'],
    queryFn: () => applicationsApi.getList({ limit: 100 }),
  });

  const {
    data: resumesData,
    isLoading: resumesLoading,
    isError: resumesError,
    error: resumesErrorObj,
    refetch: refetchResumes,
  } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => profileApi.getResumes(),
  });

  const interestingApplications = (applicationsData?.data ?? []).filter((app: Application) =>
    ['INTERESTING', 'CV_PREPARED', 'APPLIED', 'INTERVIEW', 'OFFER'].includes(app.status),
  );

  const optimizeMutation = useMutation({
    mutationFn: () =>
      cvApi.optimize({
        resumeId: selectedResumeId || undefined,
        jobId: mode === 'job' ? selectedJobId : undefined,
        jobDescription: mode === 'manual' ? manualJobDescription : undefined,
      }),
    onSuccess: (data) => {
      setOptimizedResult({
        optimizedText: data.optimizedText,
        originalText: '',
        changes: data.changes,
        keywordsAdded: data.keywordsAdded,
        keywordsDropped: data.keywordsDropped ?? [],
        keywordEvidence: data.keywordEvidence ?? [],
        summary: data.summary,
        warning: data.warning,
      });
      // A IA pode sugerir palavra-chave que não consta no perfil. O backend já
      // remove essas; aqui o usuário fica sabendo que algo foi barrado.
      if (data.warning) {
        toast.warning(data.warning);
      } else {
        toast.success('CV otimizado com sucesso!');
      }
    },
    onError: () => toast.error('Erro ao otimizar CV'),
  });

  const exportPdfMutation = useMutation({
    mutationFn: () =>
      cvApi.exportPdf({
        resumeId: selectedResumeId || undefined,
        jobId: mode === 'job' ? selectedJobId : undefined,
        optimizedText: optimizedResult?.optimizedText,
      }),
    onSuccess: (blob) => {
      downloadBlob(blob, `cv-otimizado${mode === 'job' && selectedJobId ? '-vaga' : ''}.pdf`);
      toast.success('PDF gerado com sucesso!');
    },
    onError: () => toast.error('Erro ao gerar PDF'),
  });

  const [atsCheckData, setAtsCheckData] = useState<{
    score: number;
    issues: Array<{ severity: string; code: string; message: string; fix?: string }>;
    stats: {
      estimatedPages: number;
      wordCount: number;
      hasContactBlock: boolean;
      hasTable: boolean;
      hasMultiColumn: boolean;
    };
    keywordMatch?: { matched: string[]; missing: string[]; score: number };
  } | null>(null);

  const atsCheckMutation = useMutation({
    mutationFn: () =>
      cvApi.atsCheck({
        text: optimizedResult!.optimizedText,
        jobId: mode === 'job' ? selectedJobId : undefined,
      }),
    onSuccess: (data) => {
      setAtsCheckData(data);
      toast.success(`Verificação ATS concluída: ${data.score}/100`);
    },
    onError: () => toast.error('Erro ao verificar ATS do CV otimizado'),
  });

  const handleOptimize = () => {
    if (!selectedResumeId) {
      toast.error('Selecione um CV para otimizar');
      return;
    }
    if (mode === 'job' && !selectedJobId) {
      toast.error('Selecione uma vaga');
      return;
    }
    if (mode === 'manual' && !manualJobDescription.trim()) {
      toast.error('Cole a descrição da vaga');
      return;
    }
    optimizeMutation.mutate();
  };

  const canOptimize =
    !!selectedResumeId &&
    (mode === 'job' ? !!selectedJobId : manualJobDescription.trim().length > 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Otimizador de CV para ATS</h1>
        <p className="text-muted-foreground mt-1">
          Otimize seu currículo para uma vaga específica usando IA, mantendo apenas seus dados
          reais.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selecione a vaga alvo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">CV a ser otimizado</label>
            {resumesLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : resumesError ? (
              <ErrorState
                compact
                title="Não foi possível carregar seus CVs"
                error={resumesErrorObj}
                onRetry={() => void refetchResumes()}
              />
            ) : !resumesData || resumesData.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Você ainda não tem um CV salvo. Faça o upload em{' '}
                <a href="/profile" className="font-medium text-primary hover:underline">
                  Perfil
                </a>{' '}
                para poder otimizar.
              </p>
            ) : (
              <Select value={selectedResumeId} onValueChange={setSelectedResumeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione seu CV..." />
                </SelectTrigger>
                <SelectContent>
                  {resumesData.map((resume) => (
                    <SelectItem key={resume.id} value={resume.id}>
                      {resume.filename}
                      {resume.isDefault ? ' (padrão)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant={mode === 'job' ? 'primary' : 'outline'} onClick={() => setMode('job')}>
              <Briefcase className="h-4 w-4 mr-2" />
              Vaga salva
            </Button>
            <Button
              variant={mode === 'manual' ? 'primary' : 'outline'}
              onClick={() => setMode('manual')}
            >
              <FileText className="h-4 w-4 mr-2" />
              Descrição manual
            </Button>
          </div>

          {mode === 'job' && (
            <div>
              <label className="text-sm font-medium mb-2 block">Vaga</label>
              {applicationsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : applicationsError ? (
                <ErrorState
                  compact
                  title="Não foi possível carregar suas candidaturas"
                  error={applicationsErrorObj}
                  onRetry={() => void refetchApplications()}
                />
              ) : interestingApplications.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma vaga no board de candidaturas. Adicione vagas em Candidaturas primeiro.
                </p>
              ) : (
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma vaga..." />
                  </SelectTrigger>
                  <SelectContent>
                    {interestingApplications.map((app) => (
                      <SelectItem key={app.id} value={app.job.id}>
                        {app.job.title} - {app.job.company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {(applicationsData?.pagination.total ?? 0) > (applicationsData?.data.length ?? 0) && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Mostrando {applicationsData?.data.length} de {applicationsData?.pagination.total}{' '}
                  candidaturas. Vagas além das 100 primeiras não aparecem aqui.
                </p>
              )}
            </div>
          )}

          {mode === 'manual' && (
            <div>
              <label className="text-sm font-medium mb-2 block">Descrição da vaga</label>
              <textarea
                value={manualJobDescription}
                onChange={(e) => setManualJobDescription(e.target.value)}
                placeholder="Cole aqui a descrição completa da vaga..."
                className="min-h-[200px] w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              />
            </div>
          )}

          <Button
            onClick={handleOptimize}
            disabled={!canOptimize || optimizeMutation.isPending}
            className="w-full"
          >
            {optimizeMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Otimizando CV...
              </>
            ) : (
              'Otimizar CV'
            )}
          </Button>
        </CardContent>
      </Card>

      {optimizedResult && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Resumo da otimização</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Texto explicativo sobre o limite do ATS */}
              <div
                className="rounded border border-accent/40 bg-accent/10 p-3 text-sm"
                role="status"
              >
                <strong className="text-accent">Como ler este resultado:</strong> O ATS organiza o
                currículo para facilitar a leitura do recrutador — ele não rejeita o candidato
                sozinho. Uma pontuação baixa significa apenas que o documento pode precisar de
                ajustes para ser lido corretamente pelos sistemas de triagem, não que você será
                descartado.
              </div>

              <div>
                <h3 className="font-medium mb-2">Alterações realizadas:</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {optimizedResult.changes.map((change, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-accent">•</span>
                      <span>
                        <strong>{change.section}</strong>: {change.description}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {optimizedResult.warning && (
                <div
                  className="rounded border border-warning/40 bg-warning/10 p-3 text-sm"
                  role="status"
                >
                  <strong>Verificação de integridade:</strong> {optimizedResult.warning}
                </div>
              )}

              {optimizedResult.keywordsAdded.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Termos verificados:</h3>
                  <div className="flex flex-wrap gap-2">
                    {optimizedResult.keywordsAdded.map((keyword) => {
                      const evidencia = optimizedResult.keywordEvidence.find(
                        (e) => e.term === keyword,
                      );
                      const viaAlias =
                        evidencia?.matchedAlias && evidencia.matchedAlias !== keyword
                          ? evidencia.matchedAlias
                          : null;
                      return (
                        <span
                          key={keyword}
                          title={
                            viaAlias
                              ? `Encontrado no original como “${viaAlias}”`
                              : 'Encontrado no CV ou perfil'
                          }
                          className="px-2 py-1 bg-accent/10 text-accent text-xs rounded"
                        >
                          {keyword}
                          {viaAlias && (
                            <span className="ml-1 text-accent/70">(como “{viaAlias}”)</span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {optimizedResult.keywordsDropped.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Termos não encontrados (removidos):</h3>
                  <div className="flex flex-wrap gap-2">
                    {optimizedResult.keywordsDropped.map((keyword) => (
                      <span
                        key={keyword}
                        title="Não existe no CV nem no perfil"
                        className="px-2 py-1 bg-error/10 text-error text-xs rounded line-through"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Diff antes/depois */}
              <div>
                <h3 className="font-medium mb-2">Antes e depois</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1">CV original</h4>
                    <div className="rounded bg-surface-1 p-2 text-xs text-muted-overflow max-h-64 overflow-y-auto font-mono">
                      {optimizedResult.originalText || '(sem texto original disponível)'}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1">CV otimizado</h4>
                    <div className="rounded bg-surface-2 p-2 text-xs text-muted-overflow max-h-64 overflow-y-auto font-mono">
                      {optimizedResult.optimizedText}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Resumo profissional sugerido:</h3>
                <p className="text-sm text-muted-foreground">{optimizedResult.summary}</p>
              </div>

              <Button
                onClick={() => exportPdfMutation.mutate()}
                disabled={exportPdfMutation.isPending}
                className="w-full"
              >
                {exportPdfMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando PDF...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar PDF otimizado
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAtsCheckData(null);
                  void atsCheckMutation.mutate();
                }}
                disabled={atsCheckMutation.isPending || !optimizedResult}
                className="w-full mt-2"
              >
                {atsCheckMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verificando ATS...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Verificar ATS do CV otimizado
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview do CV otimizado</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm bg-surface-2 p-4 rounded-lg max-h-[600px] overflow-y-auto">
                {optimizedResult.optimizedText}
              </pre>
            </CardContent>
          </Card>

          {atsCheckData && (
            <Card>
              <CardHeader>
                <CardTitle>Verificação ATS do CV otimizado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 rounded-lg border p-3">
                      <div className="flex justify-between text-xs font-medium mb-2 text-muted-foreground">
                        <span>Score ATS</span>
                        <span className="font-mono">{atsCheckData.score.toFixed(0)}/100</span>
                      </div>
                      <div className="w-full bg-surface-2 rounded-full h-4">
                        <div
                          className={`h-4 rounded-full transition-all duration-300 ${
                            atsCheckData.score >= 70
                              ? 'bg-emerald-500'
                              : atsCheckData.score >= 40
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                          }`}
                          style={{ width: `${atsCheckData.score}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {atsCheckData.keywordMatch && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-lg border p-3">
                          <h4 className="text-sm font-semibold mb-2">
                            Palavras-chave encontradas
                            <span className="ml-2 text-xs font-normal border px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                              {atsCheckData.keywordMatch.matched.length}
                            </span>
                          </h4>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {atsCheckData.keywordMatch.matched.map((k) => (
                              <li key={k} className="flex items-center gap-1">
                                <span className="text-emerald-600">✓</span>
                                {k}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-lg border p-3">
                          <h4 className="text-sm font-semibold mb-2">
                            Palavras-chave em falta
                            <span className="ml-2 text-xs font-normal border px-2 py-0.5 rounded bg-rose-100 text-rose-700">
                              {atsCheckData.keywordMatch.missing.length}
                            </span>
                          </h4>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {atsCheckData.keywordMatch.missing.map((k) => (
                              <li key={k} className="flex items-center gap-1">
                                <span className="text-rose-600">✗</span>
                                {k}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </>
                  )}

                  {atsCheckData.issues.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Pontos de atenção</h4>
                      <ul className="text-xs text-muted-foreground space-y-1 max-h-40 overflow-y-auto">
                        {atsCheckData.issues.map((issue, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                issue.severity === 'high'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {issue.severity}
                            </span>
                            <span>{issue.message}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground mt-2">
                    {atsCheckData.stats.wordCount} palavras •
                    {atsCheckData.stats.hasContactBlock
                      ? 'Tem bloco de contacto'
                      : 'Sem bloco de contacto'}{' '}
                    •{atsCheckData.stats.hasMultiColumn ? 'Layout multi-colunas' : 'Layout simples'}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!optimizedResult && !optimizeMutation.isPending && !resumesError && !applicationsError && (
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title="Nenhuma otimização ainda"
          description="Selecione uma vaga ou cole a descrição e clique em 'Otimizar CV' para começar."
          actionLabel="Ver vagas"
          actionHref="/jobs"
        />
      )}
    </div>
  );
}
