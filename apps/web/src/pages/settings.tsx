import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { Info, Bot, Globe, Clock, Key, ExternalLink } from 'lucide-react'
import { aiProvidersApi, setupApi, settingsApi, adminApi, type AiProvider } from '../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
import { EmptyState } from '../components/empty-state'
import { ErrorBoundary } from '../components/error-boundary'
import { toast } from '../components/ui/toast'

const cronSchema = z.object({
  jobCollectionCron: z.string().min(1),
  dailyReportCron: z.string().min(1),
})

type CronFormData = z.infer<typeof cronSchema>

export function SettingsPage() {
  return (
    <ErrorBoundary onRetry={() => window.location.reload()}>
      <SettingsPageContent />
    </ErrorBoundary>
  )
}

function SettingsPageContent() {
  const [activeTab, setActiveTab] = useState<'ai' | 'sources' | 'cron'>('ai')
  const [editingProvider, setEditingProvider] = useState<AiProvider | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    baseUrl: '',
    apiKey: '',
    model: '',
  })
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; error?: string }>>({})
   const [formTestResult, setFormTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [apifyToken, setApifyToken] = useState('')
  const [isSavingApify, setIsSavingApify] = useState(false)
  const [adzunaAppId, setAdzunaAppId] = useState('')
  const [adzunaAppKey, setAdzunaAppKey] = useState('')
  const [isSavingAdzuna, setIsSavingAdzuna] = useState(false)
  const queryClient = useQueryClient()

  const { data: providersData, isLoading: isLoadingProviders } = useQuery({
    queryKey: ['aiProviders'],
    queryFn: () => aiProvidersApi.list(),
  })

  const { data: apifyTokenStatus, refetch: refetchApifyToken } = useQuery({
    queryKey: ['apifyToken'],
    queryFn: () => adminApi.apifyToken.status(),
  })

  const { data: adzunaCredentialsStatus, refetch: refetchAdzunaCredentials } = useQuery({
    queryKey: ['adzunaCredentials'],
    queryFn: () => adminApi.adzunaCredentials.status(),
  })

  const { data: cronSettings } = useQuery({
    queryKey: ['settings', 'cron'],
    queryFn: () => settingsApi.getScope('cron'),
  })

  const { data: sourcesData, isLoading: isLoadingSources } = useQuery({
    queryKey: ['admin', 'sources'],
    queryFn: () => adminApi.getSources(),
  })

  const providers = providersData?.providers ?? []
  const sources = sourcesData?.sources ?? []

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      aiProvidersApi.create({ ...data, isActive: providers.length === 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiProviders'] })
      setIsCreating(false)
      resetForm()
      toast.success('Provedor criado com sucesso')
    },
    onError: () => toast.error('Erro ao criar provedor'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof formData> }) =>
      aiProvidersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiProviders'] })
      setEditingProvider(null)
      resetForm()
      toast.success('Provedor atualizado')
    },
    onError: () => toast.error('Erro ao atualizar provedor'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => aiProvidersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiProviders'] })
      toast.success('Provedor excluído')
    },
    onError: () => toast.error('Erro ao excluir provedor'),
  })

  const setActiveMutation = useMutation({
    mutationFn: (id: string) => aiProvidersApi.setActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiProviders'] })
      toast.success('Provedor ativado')
    },
    onError: () => toast.error('Erro ao ativar provedor'),
  })

  const testSavedMutation = useMutation({
    mutationFn: (id: string) => aiProvidersApi.test(id),
    onSuccess: (result, id) => {
      setTestResults((prev) => ({ ...prev, [id]: result }))
    },
    onError: (error: any, id) => {
      setTestResults((prev) => ({ ...prev, [id]: { ok: false, error: error.message } }))
    },
  })

  const testMutation = useMutation({
    mutationFn: (data: { baseUrl: string; apiKey: string; model: string }) =>
      setupApi.testConnection(data),
    onSuccess: (result) => {
      setFormTestResult(result)
    },
    onError: (error: any) => {
      setFormTestResult({ ok: false, error: error.message })
    },
  })

  const saveApifyTokenMutation = useMutation({
    mutationFn: (token: string) => adminApi.apifyToken.save(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apifyToken'] })
      refetchApifyToken()
      setApifyToken('')
      setIsSavingApify(false)
      toast.success('Token do Apify salvo com sucesso')
    },
    onError: () => {
      setIsSavingApify(false)
      toast.error('Erro ao salvar token do Apify')
    },
  })

  const removeApifyTokenMutation = useMutation({
    mutationFn: () => adminApi.apifyToken.remove(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apifyToken'] })
      refetchApifyToken()
      toast.success('Token do Apify removido')
    },
    onError: () => {
      toast.error('Erro ao remover token do Apify')
    },
  })

  const saveAdzunaCredentialsMutation = useMutation({
    mutationFn: (data: { appId: string; appKey: string }) => adminApi.adzunaCredentials.save(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adzunaCredentials'] })
      refetchAdzunaCredentials()
      setAdzunaAppId('')
      setAdzunaAppKey('')
      setIsSavingAdzuna(false)
      toast.success('Credenciais da Adzuna salvas com sucesso')
    },
    onError: () => {
      setIsSavingAdzuna(false)
      toast.error('Erro ao salvar credenciais da Adzuna')
    },
  })

  const removeAdzunaCredentialsMutation = useMutation({
    mutationFn: () => adminApi.adzunaCredentials.remove(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adzunaCredentials'] })
      refetchAdzunaCredentials()
      toast.success('Credenciais da Adzuna removidas')
    },
    onError: () => {
      toast.error('Erro ao remover credenciais da Adzuna')
    },
  })

  const cronForm = useForm<CronFormData>({
    resolver: zodResolver(cronSchema),
    defaultValues: {
      jobCollectionCron: cronSettings?.settings.jobCollectionCron ?? '0 6 * * *',
      dailyReportCron: cronSettings?.settings.dailyReportCron ?? '5 18 * * *',
    },
  })

  const saveCron = useMutation({
    mutationFn: (data: CronFormData) => setupApi.saveCron(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Agendamento salvo com sucesso')
    },
    onError: () => toast.error('Erro ao salvar agendamento'),
  })

  const toggleSourceMutation = useMutation({
    mutationFn: ({ sourceId, enabled }: { sourceId: string; enabled: boolean }) =>
      adminApi.toggleSource(sourceId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'sources'] })
    },
  })

  const collectNowMutation = useMutation({
    mutationFn: () => adminApi.collectNow(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      toast.success('Coleta iniciada com sucesso')
    },
    onError: () => toast.error('Erro na coleta'),
  })

  const processAllMutation = useMutation({
    mutationFn: () => adminApi.processAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      toast.success('Processamento iniciado')
    },
    onError: () => toast.error('Erro no processamento'),
  })

  function resetForm() {
    setFormData({ name: '', baseUrl: '', apiKey: '', model: '' })
    setFormTestResult(null)
  }

  function startEdit(provider: AiProvider) {
    setEditingProvider(provider)
    setFormData({
      name: provider.name,
      baseUrl: provider.baseUrl,
      apiKey: '',
      model: provider.model,
    })
    setIsCreating(false)
    setFormTestResult(null)
  }

  function startCreate() {
    setIsCreating(true)
    setEditingProvider(null)
    resetForm()
  }

  function cancelEdit() {
    setEditingProvider(null)
    setIsCreating(false)
    resetForm()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editingProvider) {
      updateMutation.mutate({
        id: editingProvider.id,
        data: {
          ...formData,
          ...(formData.apiKey ? { apiKey: formData.apiKey } : {}),
        },
      })
    } else {
      createMutation.mutate(formData)
    }
  }

  function handleTest(e: React.FormEvent) {
    e.preventDefault()
    setFormTestResult(null)
    testMutation.mutate(formData)
  }

  function handleApifyTokenSubmit() {
    if (!apifyToken.trim()) return
    setIsSavingApify(true)
    saveApifyTokenMutation.mutate(apifyToken.trim())
  }

  function handleRemoveApifyToken() {
    removeApifyTokenMutation.mutate()
  }

  function handleAdzunaCredentialsSubmit() {
    if (!adzunaAppId.trim() || !adzunaAppKey.trim()) return
    setIsSavingAdzuna(true)
    saveAdzunaCredentialsMutation.mutate({ appId: adzunaAppId.trim(), appKey: adzunaAppKey.trim() })
  }

  function handleRemoveAdzunaCredentials() {
    removeAdzunaCredentialsMutation.mutate()
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  const tabs = [
    { id: 'ai', label: 'IA', icon: Bot },
    { id: 'sources', label: 'Fontes', icon: Globe },
    { id: 'cron', label: 'Cron', icon: Clock },
  ] as const

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Configurações</h1>

      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon
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
          )
        })}
      </div>

      {activeTab === 'ai' && (
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
                              <Badge variant="success" className="text-xs">Ativo</Badge>
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(provider)}
                          >
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
                        <div className={`mt-2 text-sm ${testResults[provider.id].ok ? 'text-success' : 'text-error'}`}>
                          {testResults[provider.id].ok ? '✓ Conexão OK' : `✗ Erro: ${testResults[provider.id].error}`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {(isCreating || editingProvider) && (
                  <form onSubmit={handleSubmit} className="space-y-4 border-t border-slate-700 pt-4">
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
                        API Key {editingProvider && <span className="text-muted-foreground">(deixe vazio para manter)</span>}
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
                        disabled={testMutation.isPending || !formData.baseUrl || !formData.apiKey || !formData.model}
                      >
                        {testMutation.isPending ? 'Testando...' : 'Testar Conexão'}
                      </Button>
                      <Button type="button" variant="ghost" onClick={cancelEdit}>
                        Cancelar
                      </Button>
                    </div>
                    {formTestResult && (
                      <div className={`text-sm ${formTestResult.ok ? 'text-success' : 'text-error'}`}>
                        {formTestResult.ok ? '✓ Conexão OK' : `✗ Erro: ${formTestResult.error}`}
                      </div>
                    )}
                  </form>
                )}
              </>
            )}
          </CardContent>
        </Card>
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
                  disabled={processAllMutation.isPending}
                >
                  {processAllMutation.isPending ? 'Processando...' : '⚡ Processar Todas'}
                </Button>
                <Button
                  size="sm"
                  onClick={() => collectNowMutation.mutate()}
                  disabled={collectNowMutation.isPending}
                >
                  {collectNowMutation.isPending ? 'Buscando...' : '🔍 Buscar Agora'}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingSources ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-[var(--radius-md)] bg-surface-2 border border-border">
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
                className="py-8"
              />
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  Ative ou desative as fontes de vagas. Use &quot;Buscar Agora&quot; para uma busca manual imediata.
                </p>
                {collectNowMutation.isSuccess && (
                  <div className="mb-4 p-3 rounded bg-success/10 border border-success text-success text-sm">
                    ✓ Coleta concluída: {collectNowMutation.data?.collected ?? 0} vagas encontradas
                  </div>
                )}
                {collectNowMutation.isError && (
                  <div className="mb-4 p-3 rounded bg-error/10 border border-error text-error text-sm">
                    ✗ Erro na coleta. Tente novamente.
                  </div>
                )}
                {processAllMutation.isSuccess && (
                  <div className="mb-4 p-3 rounded bg-success/10 border border-success text-success text-sm">
                    ✓ {processAllMutation.data?.message ?? 'Processamento iniciado'}
                  </div>
                )}
                {processAllMutation.isError && (
                  <div className="mb-4 p-3 rounded bg-error/10 border border-error text-error text-sm">
                    ✗ Erro no processamento. Tente novamente.
                  </div>
                )}
                <div className="space-y-4">
                  {sources.map((source) => (
                    <div
                      key={source.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-surface-2 border border-border"
                    >
                      <div>
                        <div className="font-medium text-foreground">{source.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {source.description}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {source.enabled ? 'Ativo' : 'Desativado'}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={source.enabled ? 'secondary' : 'outline'}
                        onClick={() =>
                          toggleSourceMutation.mutate({
                            sourceId: source.id,
                            enabled: !source.enabled,
                          })
                        }
                        disabled={toggleSourceMutation.isPending}
                      >
                        {source.enabled ? 'Desativar' : 'Ativar'}
                      </Button>
                    </div>
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
                    href={apifyTokenStatus?.links?.console || 'https://console.apify.com/account#/integrations/api-token'}
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
                    <span className="text-muted-foreground">via banco de dados (criptografado)</span>
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
                      {isSavingApify ? 'Salvando...' : apifyTokenStatus.configured && !apifyTokenStatus.fromEnv ? 'Atualizar Token' : 'Salvar Token'}
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
                  Fonte agregadora com free tier de 1k chamadas/mês. Cobre Brasil e mais 16 países. Para usar, cadastre-se no{' '}
                  <a
                    href={adzunaCredentialsStatus?.links?.signup || 'https://developer.adzuna.com/signup'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent/80 underline inline-flex items-center gap-1"
                  >
                    developer.adzuna.com
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {' '}e cole suas credenciais abaixo.
                </p>

                {adzunaCredentialsStatus.configured && !adzunaCredentialsStatus.fromEnv && (
                  <div className="mb-4 p-3 bg-success/10 border border-success text-success text-sm rounded-lg flex items-center gap-2">
                    <span className="text-success font-medium">✓ Credenciais configuradas</span>
                    <span className="text-muted-foreground">via banco de dados (criptografado)</span>
                  </div>
                )}

                {adzunaCredentialsStatus.fromEnv && (
                  <div className="mb-4 p-3 bg-warning/10 border border-warning text-warning text-sm rounded-lg">
                    <span className="font-medium">⚠ Credenciais vindo de variáveis de ambiente</span>
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
                    {removeAdzunaCredentialsMutation.isPending ? 'Removendo...' : 'Remover Credenciais'}
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
                      {isSavingAdzuna ? 'Salvando...' : adzunaCredentialsStatus.configured && !adzunaCredentialsStatus.fromEnv ? 'Atualizar Credenciais' : 'Salvar Credenciais'}
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
                O sistema busca novas vagas automaticamente nos horários configurados abaixo.
                Você também pode fazer uma busca manual a qualquer momento na aba &quot;Fontes&quot;.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground/80">Formato:</strong> minuto hora dia-do-mês mês dia-da-semana
              </p>
              <ul className="text-xs text-muted-foreground/70 mt-2 space-y-1">
                <li>• <code className="text-muted-foreground">0 6 * * *</code> = Todo dia às 6h</li>
                <li>• <code className="text-muted-foreground">*/6 * * * *</code> = A cada 6 horas</li>
                <li>• <code className="text-muted-foreground">0 9 * * 1-5</code> = Dias úteis às 9h</li>
              </ul>
            </div>
            <form
              onSubmit={cronForm.handleSubmit((data) => saveCron.mutate(data))}
              className="space-y-4"
            >
              <div>
                <label className="text-sm font-medium">Coleta de Vagas</label>
                <Input
                  {...cronForm.register('jobCollectionCron')}
                  placeholder="0 6 * * *"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Padrão: todo dia às 6h (formato cron)
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Relatório Diário</label>
                <Input
                  {...cronForm.register('dailyReportCron')}
                  placeholder="5 18 * * *"
                />
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
    </div>
  )
}
