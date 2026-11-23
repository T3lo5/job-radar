import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { setupApi, authApi, aiProvidersApi, profileApi } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from '../components/ui/toast';
import { Loader2, CheckCircle, XCircle, Lock } from 'lucide-react';

const JOB_TYPE_OPTIONS = [
  'Full Stack',
  'Frontend',
  'Backend',
  'Software Engineer',
  'Software Developer',
  'Web Developer',
  'Mobile Developer',
  'DevOps',
  'Data Engineer',
  'Data Scientist',
  'Product Manager',
  'Project Manager',
  'UI/UX Designer',
  'Designer',
  'Marketing',
  'Growth Marketing',
  'Sales',
] as const;

const accountSchema = z
  .object({
    email: z.string().email('Informe um email válido'),
    password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type AccountData = z.infer<typeof accountSchema>;

const aiSchema = z.object({
  name: z.string().min(1, 'Informe um nome'),
  baseUrl: z.string().min(1, 'Informe a URL base'),
  apiKey: z.string().min(1, 'Informe a API Key'),
  model: z.string().min(1, 'Informe o modelo'),
});

type AIData = z.infer<typeof aiSchema>;

const cronSchema = z.object({
  cronExpression: z.string().min(1, 'Informe a expressão cron'),
});

type CronData = z.infer<typeof cronSchema>;

export function SetupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  const aiTestResult = useState<{ ok: boolean; error?: string } | null>(null);
  const [aiTesting, setAiTesting] = useState(false);

  const handleTestAiConnection = async () => {
    setAiTesting(true);
    aiTestResult[1](null);
    try {
      const result = await setupApi.testConnection({
        baseUrl: aiForm.watch('baseUrl'),
        apiKey: aiForm.watch('apiKey'),
        model: aiForm.watch('model'),
      });
      aiTestResult[1](result);
      if (result.ok) {
        toast.success('Conexão OK!');
      } else {
        toast.error(`Erro: ${result.error}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      aiTestResult[1]({ ok: false, error: msg });
      toast.error(`Erro: ${msg}`);
    } finally {
      setAiTesting(false);
    }
  };

  // Passo 0: criação da conta. Se a conta já existe (ex.: reload no meio do
  // wizard), começa direto no passo de perfil.
  const [accountCreated, setAccountCreated] = useState(false);
  const [isCheckingAccount, setIsCheckingAccount] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void authApi
      .status()
      .then((status) => {
        if (cancelled) return;
        if (status.accountExists) {
          setAccountCreated(true);
          setStep(1);
        }
      })
      .catch(() => {
        // Sem resposta: segue no passo de conta, que é o único que cria.
      })
      .finally(() => {
        if (!cancelled) setIsCheckingAccount(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const accountForm = useForm<AccountData>({
    resolver: zodResolver(accountSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const profileForm = useForm<{
    title: string;
    location: string;
    seniority: string;
    jobTypes: string[];
  }>({
    defaultValues: { title: '', location: '', seniority: '', jobTypes: [] },
  });

  const aiForm = useForm<AIData>({
    resolver: zodResolver(aiSchema),
    defaultValues: {
      name: 'BAI',
      baseUrl: '',
      apiKey: '',
      model: 'deepseek-v4-flash',
    },
  });

  const cronForm = useForm<CronData>({
    resolver: zodResolver(cronSchema),
    defaultValues: { cronExpression: '0 */6 * * *' },
  });

  const [profileJobTypes, setProfileJobTypes] = useState<string[]>([]);
  const [newJobType, setNewJobType] = useState('');

  const addJobType = () => {
    if (!newJobType.trim()) return;
    if (!profileJobTypes.includes(newJobType.trim())) {
      const next = [...profileJobTypes, newJobType.trim()];
      setProfileJobTypes(next);
      profileForm.setValue('jobTypes', next);
    }
    setNewJobType('');
  };

  const removeJobType = (type: string) => {
    const next = profileJobTypes.filter((t) => t !== type);
    setProfileJobTypes(next);
    profileForm.setValue('jobTypes', next);
  };

  const handleCreateAccount = accountForm.handleSubmit(async (data) => {
    setIsCreatingAccount(true);
    try {
      await authApi.setup({
        email: data.email.trim(),
        password: data.password,
        confirmPassword: data.confirmPassword,
      });
      // A resposta já seta o cookie de sessão: o resto do wizard usa ela.
      setAccountCreated(true);
      toast.success('Conta criada! Você já está logado.');
      setStep(1);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Erro ao criar conta';
      toast.error(message);
    } finally {
      setIsCreatingAccount(false);
    }
  });

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      const aiValues = aiForm.getValues();
      if (aiValues.name && aiValues.baseUrl && aiValues.apiKey && aiValues.model) {
        await aiProvidersApi.create({
          name: aiValues.name,
          baseUrl: aiValues.baseUrl,
          apiKey: aiValues.apiKey,
          model: aiValues.model,
          isActive: true,
        });
      }
      await setupApi.saveCron({
        jobCollectionCron: cronForm.getValues().cronExpression,
      });

      const profileValues = profileForm.getValues();
      if (
        profileValues.title ||
        profileValues.location ||
        profileValues.seniority ||
        profileJobTypes.length > 0
      ) {
        await profileApi.update({
          title: profileValues.title || undefined,
          location: profileValues.location || undefined,
          seniority: profileValues.seniority ? (profileValues.seniority as any) : undefined,
          jobTypes: profileJobTypes.length > 0 ? profileJobTypes : undefined,
        });
      }

      await setupApi.complete();
      toast.success('Configuração concluída!');
      navigate('/');
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err as Error)?.message ??
        'Erro na configuração';
      toast.error(message);
      setIsCompleting(false);
    }
  };

  const handleSkip = async () => {
    try {
      await setupApi.complete();
      toast.success('Setup pulado. Você pode configurar depois em Configurações.');
      navigate('/');
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err as Error)?.message ??
        'Erro ao pular setup';
      toast.error(message);
    }
  };

  const steps = [
    { title: 'Conta', component: 'account', optional: false },
    { title: 'Perfil', component: 'profile', optional: true },
    { title: 'IA', component: 'ai', optional: false },
    { title: 'Cron', component: 'cron', optional: true },
    { title: 'Concluir', component: 'complete', optional: false },
  ];

  return (
    <div className="mx-auto max-w-lg py-10">
      <h1 className="mb-6 text-center text-3xl font-bold">Configuração Inicial</h1>

      <div className="mb-4 flex justify-center gap-2">
        {steps.map((s, i) => {
          // Passos depois da conta exigem sessão, que só existe após criá-la.
          const locked = i > 0 && !accountCreated;
          return (
            <Button
              key={s.title}
              variant={i === step ? 'primary' : 'outline'}
              size="sm"
              disabled={locked}
              title={locked ? 'Crie sua conta primeiro' : undefined}
              onClick={() => setStep(i)}
            >
              {s.title}
              {s.optional && ' (opcional)'}
            </Button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {steps[step].title}
            {steps[step].optional && ' (opcional)'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 0 && (
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Crie a conta que você vai usar para entrar. A senha é guardada com hash — nem o
                banco de dados consegue revelá-la. Depois disso você pode acessar de qualquer
                dispositivo.
              </p>
              <div>
                <label htmlFor="account-email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="account-email"
                  type="email"
                  autoComplete="username"
                  {...accountForm.register('email')}
                  placeholder="voce@exemplo.com"
                  className="mt-1"
                  autoFocus
                />
                {accountForm.formState.errors.email && (
                  <p className="text-xs text-error mt-1">
                    {accountForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="account-password" className="text-sm font-medium">
                  Senha
                </label>
                <Input
                  id="account-password"
                  type="password"
                  autoComplete="new-password"
                  {...accountForm.register('password')}
                  placeholder="Mínimo de 8 caracteres"
                  className="mt-1"
                />
                {accountForm.formState.errors.password && (
                  <p className="text-xs text-error mt-1">
                    {accountForm.formState.errors.password.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="account-confirm" className="text-sm font-medium">
                  Confirme a senha
                </label>
                <Input
                  id="account-confirm"
                  type="password"
                  autoComplete="new-password"
                  {...accountForm.register('confirmPassword')}
                  placeholder="Repita a senha"
                  className="mt-1"
                />
                {accountForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-error mt-1">
                    {accountForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Guarde esta senha em algum lugar seguro. Ela protege seus dados e é a única forma de
                entrar.
              </p>
              <Button type="submit" disabled={isCreatingAccount || isCheckingAccount}>
                {isCreatingAccount ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar conta'
                )}
              </Button>
            </form>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Conte um pouco sobre você para personalizar a busca de vagas. Você também pode pular
                esta etapa e configurar depois.
              </p>
              <div>
                <label className="text-sm font-medium">Cargo desejado</label>
                <Input
                  value={profileForm.watch('title')}
                  onChange={(e) => profileForm.setValue('title', e.target.value)}
                  placeholder="Ex: Desenvolvedor Full Stack"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Localização</label>
                <Input
                  value={profileForm.watch('location')}
                  onChange={(e) => profileForm.setValue('location', e.target.value)}
                  placeholder="Ex: São Paulo, Brasil"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Senioridade</label>
                <select
                  value={profileForm.watch('seniority')}
                  onChange={(e) => profileForm.setValue('seniority', e.target.value)}
                  className="flex h-10 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-sm"
                >
                  <option value="">Selecione...</option>
                  <option value="INTERN">Estagiário</option>
                  <option value="JUNIOR">Júnior</option>
                  <option value="MID">Pleno</option>
                  <option value="SENIOR">Sênior</option>
                  <option value="SPECIALIST">Especialista</option>
                  <option value="LEAD">Lead</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Tipos de vaga</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {JOB_TYPE_OPTIONS.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        if (profileJobTypes.includes(type)) {
                          removeJobType(type);
                        } else {
                          setProfileJobTypes([...profileJobTypes, type]);
                          profileForm.setValue('jobTypes', [...profileJobTypes, type]);
                        }
                      }}
                      className={`px-3 py-1 rounded-full text-sm border ${
                        profileJobTypes.includes(type)
                          ? 'bg-accent/10 text-accent border-accent'
                          : 'bg-surface-2 text-foreground border-border'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={newJobType}
                    onChange={(e) => setNewJobType(e.target.value)}
                    placeholder="Outro cargo..."
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addJobType())}
                  />
                  <Button type="button" onClick={addJobType} variant="outline">
                    +
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={aiForm.handleSubmit(() => {})} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A IA é usada para analisar vagas, otimizar seu CV e gerar resumos. Você pode pular e
                configurar depois em Configurações.
              </p>
              <div>
                <label className="text-sm font-medium">Nome</label>
                <Input
                  value={aiForm.watch('name')}
                  onChange={(e) => aiForm.setValue('name', e.target.value)}
                  placeholder="Ex: BAI, OpenAI, Ollama..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Base URL (endpoint completo)</label>
                <Input
                  value={aiForm.watch('baseUrl')}
                  onChange={(e) => aiForm.setValue('baseUrl', e.target.value)}
                  placeholder="https://api.openai.com/v1"
                />
                <p className="text-xs text-muted-foreground/70 mt-1">
                  URL completa do endpoint de chat completions
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">API Key</label>
                <Input
                  type="password"
                  value={aiForm.watch('apiKey')}
                  onChange={(e) => aiForm.setValue('apiKey', e.target.value)}
                  placeholder="sk-..."
                />
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Cole apenas o token, sem "Bearer" na frente
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Modelo</label>
                <Input
                  value={aiForm.watch('model')}
                  onChange={(e) => aiForm.setValue('model', e.target.value)}
                  placeholder="deepseek-v4-flash"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={handleTestAiConnection}
                  disabled={
                    aiTesting ||
                    !aiForm.watch('baseUrl') ||
                    !aiForm.watch('apiKey') ||
                    !aiForm.watch('model')
                  }
                >
                  {aiTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testando...
                    </>
                  ) : (
                    'Testar conexão'
                  )}
                </Button>
                {aiTestResult[0] && (
                  <span
                    className={`text-sm flex items-center gap-1 ${aiTestResult[0].ok ? 'text-success' : 'text-error'}`}
                  >
                    {aiTestResult[0].ok ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    {aiTestResult[0].ok ? 'Conexão OK' : `Erro: ${aiTestResult[0].error}`}
                  </span>
                )}
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={cronForm.handleSubmit(() => {})} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Frequência de Coleta</label>
                <Input
                  value={cronForm.watch('cronExpression')}
                  onChange={(e) => cronForm.setValue('cronExpression', e.target.value)}
                  placeholder="0 */6 * * *"
                />
                <p className="mt-1 text-xs text-muted-foreground">Padrão: a cada 6 horas</p>
              </div>
            </form>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Revise suas configurações e clique em concluir para finalizar.
              </p>
              <div className="space-y-1 text-sm">
                {profileForm.watch('title') && (
                  <p>
                    <strong>Perfil:</strong> {profileForm.watch('title')}{' '}
                    {profileForm.watch('seniority') && (
                      <span>({profileForm.watch('seniority')})</span>
                    )}{' '}
                    {profileForm.watch('location') && (
                      <span>- {profileForm.watch('location')}</span>
                    )}
                  </p>
                )}
                {profileJobTypes.length > 0 && (
                  <p>
                    <strong>Vagas:</strong> {profileJobTypes.join(', ')}
                  </p>
                )}
                {aiForm.watch('name') && (
                  <p>
                    <strong>IA:</strong> {aiForm.watch('name')} ({aiForm.watch('model')})
                  </p>
                )}
                <p>
                  <strong>Coleta:</strong> {cronForm.watch('cronExpression')}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          Voltar
        </Button>
        <div className="flex gap-2">
          {/* Sem conta não há sessão, então "Pular" no passo 0 criaria um loop
              infinito com a porteira de auth. */}
          {step > 0 && steps[step].optional && (
            <Button variant="ghost" onClick={() => setStep((s) => s + 1)}>
              Pular
            </Button>
          )}
          {step > 0 && !steps[step].optional && (
            <Button variant="ghost" onClick={handleSkip}>
              Pular
            </Button>
          )}
          {step === 0 ? (
            <Button onClick={handleCreateAccount} disabled={isCreatingAccount || isCheckingAccount}>
              {isCreatingAccount ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar conta'
              )}
            </Button>
          ) : step < steps.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)}>Próximo</Button>
          ) : (
            <Button onClick={handleComplete} disabled={isCompleting}>
              {isCompleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Concluindo...
                </>
              ) : (
                'Concluir'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
