import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setupApi, aiProvidersApi } from '../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { toast } from '../components/ui/toast'
import { Loader2 } from 'lucide-react'

export function SetupPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [aiName, setAiName] = useState('BAI')
  const [aiBaseUrl, setAiBaseUrl] = useState('')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiModel, setAiModel] = useState('deepseek-v4-flash')
  const [cronExpression, setCronExpression] = useState('0 */6 * * *')
  const [isCompleting, setIsCompleting] = useState(false)

  const handleComplete = async () => {
    setIsCompleting(true)
    try {
      if (aiName && aiBaseUrl && aiApiKey && aiModel) {
        await aiProvidersApi.create({
          name: aiName,
          baseUrl: aiBaseUrl,
          apiKey: aiApiKey,
          model: aiModel,
          isActive: true,
        })
      }
      await setupApi.saveCron({ jobCollectionCron: cronExpression })
      await setupApi.complete()
      toast.success('Configuração concluída!')
      navigate('/')
    } catch {
      toast.error('Erro na configuração')
      setIsCompleting(false)
    }
  }

  const steps = [
    { title: 'IA', component: 'ai' },
    { title: 'Cron', component: 'cron' },
    { title: 'Concluir', component: 'complete' },
  ]

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
                  placeholder="https://api.b.ai/v1/chat/completions"
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
                  Cole apenas o token, sem &quot;Bearer&quot; na frente
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
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Frequência de Coleta</label>
                <Input
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="0 */6 * * *"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Padrão: a cada 6 horas
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Revise suas configurações e clique em concluir para finalizar.
              </p>
              <div className="space-y-1 text-sm">
                <p>
                  <strong>IA:</strong> {aiName} ({aiModel})
                </p>
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
  )
}
