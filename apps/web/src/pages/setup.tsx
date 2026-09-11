import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setupApi, aiProvidersApi, profileApi } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from '../components/ui/toast';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

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
];

export function SetupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);

  const [aiName, setAiName] = useState('BAI');
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('deepseek-v4-flash');
  const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [aiTesting, setAiTesting] = useState(false);

  const handleTestAiConnection = async () => {
    if (!aiBaseUrl || !aiApiKey || !aiModel) {
      toast.error('Preencha todos os campos antes de testar');
      return;
    }
    setAiTesting(true);
    setAiTestResult(null);
    try {
      const result = await setupApi.testConnection({
        baseUrl: aiBaseUrl,
        apiKey: aiApiKey,
        model: aiModel,
      });
      setAiTestResult(result);
      if (result.ok) {
        toast.success('Conexão OK!');
      } else {
        toast.error(`Erro: ${result.error}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      setAiTestResult({ ok: false, error: msg });
      toast.error(`Erro: ${msg}`);
    } finally {
      setAiTesting(false);
    }
  };

  const [profileTitle, setProfileTitle] = useState('');
  const [profileLocation, setProfileLocation] = useState('');
  const [profileSeniority, setProfileSeniority] = useState('');
  const [profileJobTypes, setProfileJobTypes] = useState<string[]>([]);
  const [newJobType, setNewJobType] = useState('');

  const [cronExpression, setCronExpression] = useState('0 */6 * * *');

  const addJobType = () => {
    if (!newJobType.trim()) return;
    if (!profileJobTypes.includes(newJobType.trim())) {
      setProfileJobTypes([...profileJobTypes, newJobType.trim()]);
    }
    setNewJobType('');
  };

  const removeJobType = (type: string) => {
    setProfileJobTypes(profileJobTypes.filter((t) => t !== type));
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      if (aiName && aiBaseUrl && aiApiKey && aiModel) {
        await aiProvidersApi.create({
          name: aiName,
          baseUrl: aiBaseUrl,
          apiKey: aiApiKey,
          model: aiModel,
          isActive: true,
        });
      }
      await setupApi.saveCron({ jobCollectionCron: cronExpression });

      if (profileTitle || profileLocation || profileSeniority || profileJobTypes.length > 0) {
        await profileApi.update({
          title: profileTitle || undefined,
          location: profileLocation || undefined,
          seniority: profileSeniority ? (profileSeniority as any) : undefined,
          jobTypes: profileJobTypes.length > 0 ? profileJobTypes : undefined,
        });
      }

      await setupApi.complete();
      toast.success('Configuração concluída!');
      navigate('/');
    } catch {
      toast.error('Erro na configuração');
      setIsCompleting(false);
    }
  };

  const handleSkip = async () => {
    try {
      await setupApi.complete();
      toast.success('Setup pulado. Você pode configurar depois em Configurações.');
      navigate('/');
    } catch {
      toast.error('Erro ao pular setup');
    }
  };

  const steps = [
    { title: 'Perfil', component: 'profile' },
    { title: 'IA', component: 'ai' },
    { title: 'Cron', component: 'cron' },
    { title: 'Concluir', component: 'complete' },
  ];

  return (
    <div className="mx-auto max-w-lg py-10">
      <h1 className="mb-6 text-center text-3xl font-bold">Configuração Inicial</h1>

      <div className="mb-4 flex justify-center gap-2">
        {steps.map((s, i) => (
          <Button
            key={s.title}
            variant={i === step ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setStep(i)}
          >
            {s.title}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{steps[step].title}</CardTitle>
        </CardHeader>
        <CardContent>
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Conte um pouco sobre você para personalizar a busca de vagas. Você também pode pular
                esta etapa e configurar depois.
              </p>
              <div>
                <label className="text-sm font-medium">Cargo desejado</label>
                <Input
                  value={profileTitle}
                  onChange={(e) => setProfileTitle(e.target.value)}
                  placeholder="Ex: Desenvolvedor Full Stack"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Localização</label>
                <Input
                  value={profileLocation}
                  onChange={(e) => setProfileLocation(e.target.value)}
                  placeholder="Ex: São Paulo, Brasil"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Senioridade</label>
                <select
                  value={profileSeniority}
                  onChange={(e) => setProfileSeniority(e.target.value)}
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

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A IA é usada para analisar vagas, otimizar seu CV e gerar resumos. Você pode pular e
                configurar depois em Configurações.
              </p>
              <div>
                <label className="text-sm font-medium">Nome</label>
                <Input
                  value={aiName}
                  onChange={(e) => setAiName(e.target.value)}
                  placeholder="Ex: BAI, OpenAI, Ollama..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Base URL (endpoint completo)</label>
                <Input
                  value={aiBaseUrl}
                  onChange={(e) => setAiBaseUrl(e.target.value)}
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
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  placeholder="sk-..."
                />
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Cole apenas o token, sem "Bearer" na frente
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Modelo</label>
                <Input
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  placeholder="deepseek-v4-flash"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={handleTestAiConnection}
                  disabled={aiTesting || !aiBaseUrl || !aiApiKey || !aiModel}
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
                {aiTestResult && (
                  <span
                    className={`text-sm flex items-center gap-1 ${aiTestResult.ok ? 'text-success' : 'text-error'}`}
                  >
                    {aiTestResult.ok ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    {aiTestResult.ok ? 'Conexão OK' : `Erro: ${aiTestResult.error}`}
                  </span>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Frequência de Coleta</label>
                <Input
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="0 */6 * * *"
                />
                <p className="mt-1 text-xs text-muted-foreground">Padrão: a cada 6 horas</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Revise suas configurações e clique em concluir para finalizar.
              </p>
              <div className="space-y-1 text-sm">
                {profileTitle && (
                  <p>
                    <strong>Perfil:</strong> {profileTitle}{' '}
                    {profileSeniority && `(${profileSeniority})`}{' '}
                    {profileLocation && `- ${profileLocation}`}
                  </p>
                )}
                {profileJobTypes.length > 0 && (
                  <p>
                    <strong>Vagas:</strong> {profileJobTypes.join(', ')}
                  </p>
                )}
                {aiName && (
                  <p>
                    <strong>IA:</strong> {aiName} ({aiModel})
                  </p>
                )}
                <p>
                  <strong>Coleta:</strong> {cronExpression}
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
          <Button variant="ghost" onClick={handleSkip}>
            Pular
          </Button>
          {step < steps.length - 1 ? (
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
