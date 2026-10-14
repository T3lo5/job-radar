import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useEffect } from 'react';
import { Info, Bot, Globe, Clock, Key, ExternalLink, User } from 'lucide-react';
import {
  aiProvidersApi,
  setupApi,
  settingsApi,
  adminApi,
  authApi,
  type AiProvider,
} from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/empty-state';
import { ErrorBoundary } from '../components/error-boundary';
import { toast } from '../components/ui/toast';
import { SourceCard } from '../components/SourceCard';
import {
  textoResultadoColeta,
  textoResultadoProcessamento,
  formatElapsed,
  type TextoResultado,
} from '../lib/collection-result';
import { AiUsageCard } from '../components/AiUsageCard';

const cronSchema = z.object({
  jobCollectionCron: z.string().min(1),
  dailyReportCron: z.string().min(1),
});

type CronFormData = z.infer<typeof cronSchema>;

export function SettingsPage() {
  return (
    <ErrorBoundary onRetry={() => window.location.reload()}>
      <SettingsPageContent />
    </ErrorBoundary>
  );
}

function SettingsPageContent() {
  const [activeTab, setActiveTab] = useState<'ai' | 'sources' | 'cron' | 'account'>('ai');
  const [editingProvider, setEditingProvider] = useState<AiProvider | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    baseUrl: '',
    apiKey: '',
    model: '',
  });
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; error?: string }>>(
    {},
  );
  const [formTestResult, setFormTestResult] = useState<{ ok: boolean; error?: string } | null>(
    null,
  );
  const [apifyToken, setApifyToken] = useState('');
  const [isSavingApify, setIsSavingApify] = useState(false);
  const [adzunaAppId, setAdzunaAppId] = useState('');
  const [adzunaAppKey, setAdzunaAppKey] = useState('');
  const [isSavingAdzuna, setIsSavingAdzuna] = useState(false);
  const queryClient = useQueryClient();

  const { data: providersData, isLoading: isLoadingProviders } = useQuery({
    queryKey: ['aiProviders'],
    queryFn: () => aiProvidersApi.list(),
  });

  const { data: apifyTokenStatus, refetch: refetchApifyToken } = useQuery({
    queryKey: ['apifyToken'],
    queryFn: () => adminApi.apifyToken.status(),
  });

  const { data: adzunaCredentialsStatus, refetch: refetchAdzunaCredentials } = useQuery({
    queryKey: ['adzunaCredentials'],
    queryFn: () => adminApi.adzunaCredentials.status(),
  });

  const { data: cronSettings } = useQuery({
    queryKey: ['settings', 'cron'],
    queryFn: () => settingsApi.getScope('cron'),
  });

  const { data: sourcesData, isLoading: isLoadingSources } = useQuery({
    queryKey: ['admin', 'sources'],
    queryFn: () => adminApi.getSources(),
  });

  const providers = providersData?.providers ?? [];
  const sources = sourcesData?.sources ?? [];

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      aiProvidersApi.create({ ...data, isActive: providers.length === 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiProviders'] });
      setIsCreating(false);
      resetForm();
      toast.success('Provedor criado com sucesso');
    },
    onError: () => toast.error('Erro ao criar provedor'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof formData> }) =>
      aiProvidersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiProviders'] });
      setEditingProvider(null);
      resetForm();
      toast.success('Provedor atualizado');
    },
    onError: () => toast.error('Erro ao atualizar provedor'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => aiProvidersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiProviders'] });
      toast.success('Provedor excluído');
    },
    onError: () => toast.error('Erro ao excluir provedor'),
  });

  const setActiveMutation = useMutation({
    mutationFn: (id: string) => aiProvidersApi.setActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiProviders'] });
      toast.success('Provedor ativado');
    },
    onError: () => toast.error('Erro ao ativar provedor'),
  });

  const testSavedMutation = useMutation({
    mutationFn: (id: string) => aiProvidersApi.test(id),
    onSuccess: (result, id) => {
      setTestResults((prev) => ({ ...prev, [id]: result }));
    },
    onError: (error: any, id) => {
      setTestResults((prev) => ({ ...prev, [id]: { ok: false, error: error.message } }));
    },
  });

  const testMutation = useMutation({
    mutationFn: (data: { baseUrl: string; apiKey: string; model: string }) =>
      setupApi.testConnection(data),
    onSuccess: (result) => {
      setFormTestResult(result);
    },
    onError: (error: any) => {
      setFormTestResult({ ok: false, error: error.message });
    },
  });

  const saveApifyTokenMutation = useMutation({
    mutationFn: (token: string) => adminApi.apifyToken.save(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apifyToken'] });
      refetchApifyToken();
      setApifyToken('');
      setIsSavingApify(false);
      toast.success('Token do Apify salvo com sucesso');
    },
    onError: () => {
      setIsSavingApify(false);
      toast.error('Erro ao salvar token do Apify');
    },
  });

  const removeApifyTokenMutation = useMutation({
    mutationFn: () => adminApi.apifyToken.remove(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apifyToken'] });
      refetchApifyToken();
      toast.success('Token do Apify removido');
    },
    onError: () => {
      toast.error('Erro ao remover token do Apify');
    },
  });

  const saveAdzunaCredentialsMutation = useMutation({
    mutationFn: (data: { appId: string; appKey: string }) => adminApi.adzunaCredentials.save(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adzunaCredentials'] });
      refetchAdzunaCredentials();
      setAdzunaAppId('');
      setAdzunaAppKey('');
      setIsSavingAdzuna(false);
      toast.success('Credenciais da Adzuna salvas com sucesso');
    },
    onError: () => {
      setIsSavingAdzuna(false);
      toast.error('Erro ao salvar credenciais da Adzuna');
    },
  });

  const removeAdzunaCredentialsMutation = useMutation({
    mutationFn: () => adminApi.adzunaCredentials.remove(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adzunaCredentials'] });
      refetchAdzunaCredentials();
      toast.success('Credenciais da Adzuna removidas');
    },
    onError: () => {
      toast.error('Erro ao remover credenciais da Adzuna');
    },
  });

  // ── Conta, senha e dispositivos ──────────────────────────────────────────
  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: () => authApi.me() });
  const me = meQuery.data;

  const sessionsQuery = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: () => authApi.sessions(),
  });

  const revokeSession = useMutation({
    mutationFn: (id: string) => authApi.revokeSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
      toast.success('Dispositivo desconectado');
    },
    onError: () => toast.error('Erro ao desconectar dispositivo'),
  });

  const changePasswordSchema = z
    .object({
      currentPassword: z.string().min(1, 'Informe a senha atual'),
      newPassword: z.string().min(8, 'Mínimo de 8 caracteres'),
    })
    .refine((d) => d.currentPassword !== d.newPassword, {
      message: 'A nova senha deve ser diferente da atual',
      path: ['newPassword'],
    });

  type ChangePasswordData = z.infer<typeof changePasswordSchema>;

  const changePasswordForm = useForm<ChangePasswordData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: ChangePasswordData) => authApi.changePassword(data),
    onSuccess: () => {
      changePasswordForm.reset();
      toast.success('Senha alterada com sucesso');
    },
    onError: (error) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Erro ao alterar senha';
      toast.error(message);
    },
  });

  const onChangePassword = changePasswordForm.handleSubmit((data) =>
    changePasswordMutation.mutate(data),
  );

  const cronForm = useForm<CronFormData>({
    resolver: zodResolver(cronSchema),
    defaultValues: {
      jobCollectionCron: cronSettings?.settings.jobCollectionCron ?? '0 6 * * *',
      dailyReportCron: cronSettings?.settings.dailyReportCron ?? '5 18 * * *',
    },
  });

  // `defaultValues` só é lido no primeiro render, quando a query ainda não
  // resolveu — sem este reset o formulário mostraria os defaults e, ao salvar,
  // sobrescreveria os valores reais do banco.
  useEffect(() => {
    if (cronSettings?.settings) {
      cronForm.reset({
        jobCollectionCron: cronSettings.settings.jobCollectionCron ?? '0 6 * * *',
        dailyReportCron: cronSettings.settings.dailyReportCron ?? '5 18 * * *',
      });
    }
  }, [cronSettings, cronForm]);

  const saveCron = useMutation({
    mutationFn: (data: CronFormData) => setupApi.saveCron(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Agendamento salvo com sucesso');
    },
    onError: () => toast.error('Erro ao salvar agendamento'),
  });

  const toggleSourceMutation = useMutation({
    mutationFn: ({ sourceId, enabled }: { sourceId: string; enabled: boolean }) =>
      adminApi.toggleSource(sourceId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'sources'] });
    },
  });

  // Último resultado de coleta/processamento, para o painel persistente.
  // O toast sozinho some em segundos; o painel fica até o próximo run.
  const [ultimoResultado, setUltimoResultado] = useState<{
    texto: TextoResultado;
    erros: string[];
    quando: Date;
  } | null>(null);

  // Quando a operação começou, para o cronômetro de progresso. A coleta
  // síncrona raspa 9 fontes e pode levar minutos — sem o tic-tac, parece
  // que travou.
  const [inicioOperacao, setInicioOperacao] = useState<number | null>(null);
  const [agora, setAgora] = useState(() => Date.now());

  const collectNowMutation = useMutation({
    mutationFn: () => adminApi.collectNow(),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setUltimoResultado({
        texto: textoResultadoColeta({ coletadas: r.collected, erros: r.errors }),
        erros: r.errors,
        quando: new Date(),
      });
      toast.success(
        r.collected === 1
          ? 'Coleta concluída: 1 vaga nova'
          : `Coleta concluída: ${r.collected} vagas novas`,
      );
    },
    onError: () => toast.error('Erro na coleta'),
  });

  const processAllMutation = useMutation({
    mutationFn: () => adminApi.processAll(),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setUltimoResultado({
        texto: textoResultadoProcessamento(r.count),
        erros: [],
        quando: new Date(),
      });
      toast.success(
        r.count === 0 ? 'Nada para processar' : `Processamento enfileirado: ${r.count}`,
      );
    },
    onError: () => toast.error('Erro no processamento'),
  });

  const operacaoEmAndamento = collectNowMutation.isPending || processAllMutation.isPending;

  useEffect(() => {
    if (!operacaoEmAndamento) {
      setInicioOperacao(null);
      return;
    }
    if (inicioOperacao === null) setInicioOperacao(Date.now());
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [operacaoEmAndamento, inicioOperacao]);

  function resetForm() {
    setFormData({ name: '', baseUrl: '', apiKey: '', model: '' });
    setFormTestResult(null);
  }

  function startEdit(provider: AiProvider) {
    setEditingProvider(provider);
    setFormData({
      name: provider.name,
      baseUrl: provider.baseUrl,
      apiKey: '',
      model: provider.model,
    });
    setIsCreating(false);
    setFormTestResult(null);
  }

  function startCreate() {
    setIsCreating(true);
    setEditingProvider(null);
    resetForm();
  }

  function cancelEdit() {
    setEditingProvider(null);
    setIsCreating(false);
    resetForm();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingProvider) {
      // A UI diz "deixe vazio para manter", mas `...formData` já carrega
      // `apiKey: ''` — e o schema do backend exige `min(1)`, então espalhar o
      // form inteiro resultava em 400. A chave só vai quando preenchida.
      const { apiKey, ...rest } = formData;
      updateMutation.mutate({
        id: editingProvider.id,
        data: apiKey ? { ...rest, apiKey } : rest,
      });
    } else {
      createMutation.mutate(formData);
    }
  }

  function handleTest(e: React.FormEvent) {
    e.preventDefault();
    setFormTestResult(null);
    testMutation.mutate(formData);
  }

  function handleApifyTokenSubmit() {
    if (!apifyToken.trim()) return;
    setIsSavingApify(true);
    saveApifyTokenMutation.mutate(apifyToken.trim());
  }

  function handleRemoveApifyToken() {
    removeApifyTokenMutation.mutate();
  }

  function handleAdzunaCredentialsSubmit() {
    if (!adzunaAppId.trim() || !adzunaAppKey.trim()) return;
    setIsSavingAdzuna(true);
    saveAdzunaCredentialsMutation.mutate({
      appId: adzunaAppId.trim(),
      appKey: adzunaAppKey.trim(),
    });
  }

  function handleRemoveAdzunaCredentials() {
    removeAdzunaCredentialsMutation.mutate();
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  const tabs = [
    { id: 'ai', label: 'IA', icon: Bot },
    { id: 'sources', label: 'Fontes', icon: Globe },
    { id: 'cron', label: 'Cron', icon: Clock },
    { id: 'account', label: 'Conta', icon: User },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Configurações</h1>

      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon className="h-4 w-4 mr-1" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {activeTab === 'ai' && (
        <div className="space-y-6">
          <AiUsageCard />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Provedores de IA</span>
                <Button onClick={startCreate} size="sm">
                  + Adicionar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingProviders ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-4 rounded-[var(--radius-md)] border border-border">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {providers.length === 0 && !isCreating && (
                    <p className="text-muted-foreground mb-4">
                      Nenhum provedor configurado. Clique em &quot;+ Adicionar&quot; para criar um.
                    </p>
                  )}

                  <div className="space-y-3 mb-6">
                    {providers.map((provider) => (
                      <div
                        key={provider.id}
                        className={`p-4 rounded-lg border ${
                          provider.isActive
                            ? 'border-success bg-success/10'
                            : 'border-border bg-surface'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {provider.name}
                              {provider.isActive && (
                                <Badge variant="success" className="text-xs">
                                  Ativo
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {provider.model} — {provider.baseUrl}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => testSavedMutation.mutate(provider.id)}
                              disabled={testSavedMutation.isPending}
                            >
                              {testSavedMutation.isPending ? 'Testando...' : 'Testar'}
                            </Button>
                            {!provider.isActive && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setActiveMutation.mutate(provider.id)}
                                disabled={setActiveMutation.isPending}
                              >
                                Ativar
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => startEdit(provider)}>
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => deleteMutation.mutate(provider.id)}
                              disabled={deleteMutation.isPending}
                            >
                              Excluir
                            </Button>
                          </div>
                        </div>
                        {testResults[provider.id] && (
                          <div
                            className={`mt-2 text-sm ${testResults[provider.id].ok ? 'text-success' : 'text-error'}`}
                          >
                            {testResults[provider.id].ok
                              ? '✓ Conexão OK'
                              : `✗ Erro: ${testResults[provider.id].error}`}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {(isCreating || editingProvider) && (
                    <form
                      onSubmit={handleSubmit}
                      className="space-y-4 border-t border-slate-700 pt-4"
                    >
                      <h3 className="font-medium">
                        {editingProvider ? 'Editar Provedor' : 'Novo Provedor'}
                      </h3>
                      <div>
                        <label className="text-sm font-medium">Nome</label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Ex: BAI, OpenAI, Ollama..."
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Base URL (endpoint completo)</label>
                        <Input
                          value={formData.baseUrl}
                          onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                          placeholder="https://api.b.ai/v1/chat/completions"
                          required
                        />
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          URL completa do endpoint de chat completions
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">
                          API Key{' '}
                          {editingProvider && (
                            <span className="text-muted-foreground">(deixe vazio para manter)</span>
                          )}
                        </label>
                        <Input
                          type="password"
                          value={formData.apiKey}
                          onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                          placeholder="sk-..."
                          required={!editingProvider}
                        />
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          Cole apenas o token, sem &quot;Bearer&quot; na frente
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Modelo</label>
                        <Input
                          value={formData.model}
                          onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                          placeholder="deepseek-v4-flash"
                          required
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" disabled={isPending}>
                          {isPending ? 'Salvando...' : editingProvider ? 'Atualizar' : 'Criar'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleTest}
                          disabled={
                            testMutation.isPending ||
                            !formData.baseUrl ||
                            !formData.apiKey ||
                            !formData.model
                          }
                        >
                          {testMutation.isPending ? 'Testando...' : 'Testar Conexão'}
                        </Button>
                        <Button type="button" variant="ghost" onClick={cancelEdit}>
                          Cancelar
                        </Button>
                      </div>
                      {formTestResult && (
                        <div
                          className={`text-sm ${formTestResult.ok ? 'text-success' : 'text-error'}`}
                        >
                          {formTestResult.ok ? '✓ Conexão OK' : `✗ Erro: ${formTestResult.error}`}
                        </div>
                      )}
                    </form>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'sources' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Fontes de Vagas</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => processAllMutation.mutate()}
                  disabled={operacaoEmAndamento}
                >
                  {processAllMutation.isPending ? 'Processando...' : '⚡ Processar Todas'}
                </Button>
                <Button
                  size="sm"
                  onClick={() => collectNowMutation.mutate()}
                  disabled={operacaoEmAndamento}
                >
                  {collectNowMutation.isPending ? 'Buscando...' : '🔍 Buscar Agora'}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {operacaoEmAndamento && inicioOperacao !== null && (
              <div
                className="mb-4 flex items-center gap-3 rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm"
                role="status"
              >
                <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <span>
                  {collectNowMutation.isPending
                    ? 'Buscando vagas nas fontes…'
                    : 'Enfileirando vagas para processamento…'}
                </span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {formatElapsed((agora - inicioOperacao) / 1000)}
                </span>
              </div>
            )}

            {!operacaoEmAndamento && ultimoResultado && (
              <div
                className={`mb-4 rounded-lg border p-3 text-sm ${
                  ultimoResultado.texto.temErro
                    ? 'border-warning/40 bg-warning/10'
                    : 'border-success/40 bg-success/10'
                }`}
                role="status"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{ultimoResultado.texto.titulo}</div>
                    <div className="text-muted-foreground">{ultimoResultado.texto.detalhe}</div>
                    {ultimoResultado.erros.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {ultimoResultado.erros.slice(0, 5).map((e, i) => (
                          <li key={i}>• {e}</li>
                        ))}
                        {ultimoResultado.erros.length > 5 && (
                          <li>…e mais {ultimoResultado.erros.length - 5}</li>
                        )}
                      </ul>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {ultimoResultado.quando.toLocaleTimeString('pt-BR')}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setUltimoResultado(null)}>
                    ✕
                  </Button>
                </div>
              </div>
            )}

            {isLoadingSources ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 rounded-[var(--radius-md)] bg-surface-2 border border-border"
                  >
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))}
              </div>
            ) : sources.length === 0 ? (
              <EmptyState
                title="Nenhuma fonte encontrada"
                description="Configure fontes de vagas no backend."
                actionLabel="Ver documentação"
                actionHref="https://github.com/T3lo5/job-radar/blob/main/README.md#como-adicionar-uma-nova-fonte-de-vaga"
                className="py-8"
              />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {sources.map((source) => (
                    <SourceCard
                      key={source.id}
                      source={source}
                      onToggle={(enabled) =>
                        toggleSourceMutation.mutate({
                          sourceId: source.id,
                          enabled,
                        })
                      }
                      isToggling={toggleSourceMutation.isPending}
                    />
                  ))}
                </div>
              </>
            )}

            {apifyTokenStatus && (
              <div className="border-t border-border pt-6 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Key className="h-5 w-5 text-accent" />
                  <h3 className="font-medium text-foreground">LinkedIn via Apify</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Fonte de vagas do LinkedIn usando o Apify. Configure seu token API grátis em{' '}
                  <a
                    href={
                      apifyTokenStatus?.links?.console ||
                      'https://console.apify.com/account#/integrations/api-token'
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent/80 underline inline-flex items-center gap-1"
                  >
                    console.apify.com
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  . Se não tem conta,{' '}
                  <a
                    href={apifyTokenStatus?.links?.signup || 'https://apify.com/signup'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent/80 underline"
                  >
                    cadastre-se grátis
                  </a>
                  .
                </p>

                {apifyTokenStatus.configured && !apifyTokenStatus.fromEnv && (
                  <div className="mb-4 p-3 bg-success/10 border border-success text-success text-sm rounded-lg flex items-center gap-2">
                    <span className="text-success font-medium">✓ Token configurado</span>
                    <span className="text-muted-foreground">
                      via banco de dados (criptografado)
                    </span>
                  </div>
                )}

                {apifyTokenStatus.fromEnv && (
                  <div className="mb-4 p-3 bg-warning/10 border border-warning text-warning text-sm rounded-lg">
                    <span className="font-medium">⚠ Token vindo de variável de ambiente</span>
                    <span className="text-muted-foreground block mt-1">
                      Configure via interface abaixo para gerenciar pelo sistema.
                    </span>
                  </div>
                )}

                {!apifyTokenStatus.configured && (
                  <div className="mb-4 p-3 bg-error/10 border border-error text-error text-sm rounded-lg">
                    <span className="font-medium">✗ Token não configurado</span>
                    <span className="text-muted-foreground block mt-1">
                      Esta fonte retornará 0 vagas até que o token seja configurado.
                    </span>
                  </div>
                )}

                {apifyTokenStatus.configured && !apifyTokenStatus.fromEnv && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveApifyToken}
                    disabled={removeApifyTokenMutation.isPending}
                    className="mb-4"
                  >
                    {removeApifyTokenMutation.isPending ? 'Removendo...' : 'Remover Token'}
                  </Button>
                )}

                {!apifyTokenStatus.fromEnv && (
                  <>
                    <Input
                      type="password"
                      value={apifyToken}
                      onChange={(e) => setApifyToken(e.target.value)}
                      placeholder="Cole seu token API do Apify aqui"
                      className="mb-2"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleApifyTokenSubmit}
                      disabled={!apifyToken.trim() || isSavingApify}
                    >
                      {isSavingApify
                        ? 'Salvando...'
                        : apifyTokenStatus.configured && !apifyTokenStatus.fromEnv
                          ? 'Atualizar Token'
                          : 'Salvar Token'}
                    </Button>
                  </>
                )}
              </div>
            )}

            {adzunaCredentialsStatus && (
              <div className="border-t border-border pt-6 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="h-5 w-5 text-accent" />
                  <h3 className="font-medium text-foreground">Adzuna</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Fonte agregadora com free tier de 1k chamadas/mês. Cobre Brasil e mais 16 países.
                  Para usar, cadastre-se no{' '}
                  <a
                    href={
                      adzunaCredentialsStatus?.links?.signup ||
                      'https://developer.adzuna.com/signup'
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent/80 underline inline-flex items-center gap-1"
                  >
                    developer.adzuna.com
                    <ExternalLink className="h-3 w-3" />
                  </a>{' '}
                  e cole suas credenciais abaixo.
                </p>

                {adzunaCredentialsStatus.configured && !adzunaCredentialsStatus.fromEnv && (
                  <div className="mb-4 p-3 bg-success/10 border border-success text-success text-sm rounded-lg flex items-center gap-2">
                    <span className="text-success font-medium">✓ Credenciais configuradas</span>
                    <span className="text-muted-foreground">
                      via banco de dados (criptografado)
                    </span>
                  </div>
                )}

                {adzunaCredentialsStatus.fromEnv && (
                  <div className="mb-4 p-3 bg-warning/10 border border-warning text-warning text-sm rounded-lg">
                    <span className="font-medium">
                      ⚠ Credenciais vindo de variáveis de ambiente
                    </span>
                    <span className="text-muted-foreground block mt-1">
                      Configure via interface abaixo para gerenciar pelo sistema.
                    </span>
                  </div>
                )}

                {!adzunaCredentialsStatus.configured && (
                  <div className="mb-4 p-3 bg-error/10 border border-error text-error text-sm rounded-lg">
                    <span className="font-medium">✗ Credenciais não configuradas</span>
                    <span className="text-muted-foreground block mt-1">
                      Esta fonte retornará 0 vagas até que as credenciais sejam configuradas.
                    </span>
                  </div>
                )}

                {adzunaCredentialsStatus.configured && !adzunaCredentialsStatus.fromEnv && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveAdzunaCredentials}
                    disabled={removeAdzunaCredentialsMutation.isPending}
                    className="mb-4"
                  >
                    {removeAdzunaCredentialsMutation.isPending
                      ? 'Removendo...'
                      : 'Remover Credenciais'}
                  </Button>
                )}

                {!adzunaCredentialsStatus.fromEnv && (
                  <>
                    <Input
                      type="text"
                      value={adzunaAppId}
                      onChange={(e) => setAdzunaAppId(e.target.value)}
                      placeholder="App ID"
                      className="mb-2"
                    />
                    <Input
                      type="password"
                      value={adzunaAppKey}
                      onChange={(e) => setAdzunaAppKey(e.target.value)}
                      placeholder="App Key"
                      className="mb-2"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleAdzunaCredentialsSubmit}
                      disabled={!adzunaAppId.trim() || !adzunaAppKey.trim() || isSavingAdzuna}
                    >
                      {isSavingAdzuna
                        ? 'Salvando...'
                        : adzunaCredentialsStatus.configured && !adzunaCredentialsStatus.fromEnv
                          ? 'Atualizar Credenciais'
                          : 'Salvar Credenciais'}
                    </Button>
                  </>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-4">
              Para adicionar novas fontes, edite o arquivo sources/index.ts no backend.
            </p>
          </CardContent>
        </Card>
      )}

      {activeTab === 'cron' && (
        <Card>
          <CardHeader>
            <CardTitle>Agendamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6 p-4 rounded-lg bg-surface-2 border border-border">
              <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                <Info className="h-4 w-4 text-accent" />
                Como funciona?
              </h4>
              <p className="text-sm text-muted-foreground mb-2">
                O sistema busca novas vagas automaticamente nos horários configurados abaixo. Você
                também pode fazer uma busca manual a qualquer momento na aba &quot;Fontes&quot;.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground/80">Formato:</strong> minuto hora dia-do-mês mês
                dia-da-semana
              </p>
              <ul className="text-xs text-muted-foreground/70 mt-2 space-y-1">
                <li>
                  • <code className="text-muted-foreground">0 6 * * *</code> = Todo dia às 6h
                </li>
                <li>
                  • <code className="text-muted-foreground">*/6 * * * *</code> = A cada 6 horas
                </li>
                <li>
                  • <code className="text-muted-foreground">0 9 * * 1-5</code> = Dias úteis às 9h
                </li>
              </ul>
            </div>
            <form
              onSubmit={cronForm.handleSubmit((data) => saveCron.mutate(data))}
              className="space-y-4"
            >
              <div>
                <label className="text-sm font-medium">Coleta de Vagas</label>
                <Input {...cronForm.register('jobCollectionCron')} placeholder="0 6 * * *" />
                <p className="text-xs text-muted-foreground mt-1">
                  Padrão: todo dia às 6h (formato cron)
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Relatório Diário</label>
                <Input {...cronForm.register('dailyReportCron')} placeholder="5 18 * * *" />
                <p className="text-xs text-muted-foreground mt-1">
                  Padrão: todo dia às 18:05 (formato cron)
                </p>
              </div>
              <Button type="submit" disabled={saveCron.isPending}>
                {saveCron.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === 'account' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Minha conta
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input value={me?.user.email ?? '—'} readOnly className="mt-1 bg-surface-2" />
              </div>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await authApi.logout();
                    window.location.href = '/login';
                  } catch {
                    toast.error('Erro ao sair');
                  }
                }}
              >
                Sair
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trocar senha</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onChangePassword} className="space-y-3">
                <div>
                  <label htmlFor="current-password" className="text-sm font-medium">
                    Senha atual
                  </label>
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    className="mt-1"
                    {...changePasswordForm.register('currentPassword')}
                  />
                </div>
                <div>
                  <label htmlFor="new-password" className="text-sm font-medium">
                    Nova senha
                  </label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    className="mt-1"
                    {...changePasswordForm.register('newPassword')}
                  />
                </div>
                <Button type="submit" disabled={changePasswordMutation.isPending}>
                  {changePasswordMutation.isPending ? 'Alterando...' : 'Alterar senha'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Ao trocar a senha, os outros dispositivos são desconectados. Este continua
                  conectado.
                </p>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dispositivos conectados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sessionsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : (sessionsQuery.data?.sessions ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum dispositivo ativo.</p>
              ) : (
                (sessionsQuery.data?.sessions ?? []).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded border border-border bg-surface-2 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {s.current ? 'Este dispositivo' : s.userAgent || 'Desconhecido'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Entrou {new Date(s.createdAt).toLocaleDateString('pt-BR')} · último uso{' '}
                        {new Date(s.lastUsedAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    {s.current ? (
                      <Badge variant="success">atual</Badge>
                    ) : (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => revokeSession.mutate(s.id)}
                        disabled={revokeSession.isPending}
                      >
                        Desconectar
                      </Button>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
