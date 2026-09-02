import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { applicationsApi, cvApi } from '../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Skeleton } from '../components/ui/skeleton'
import { EmptyState } from '../components/empty-state'
import { toast } from '../components/ui/toast'
import { FileText, Download, Loader2, Briefcase } from 'lucide-react'

type OptimizationMode = 'job' | 'manual'

type Application = {
  id: string
  status: string
  job: {
    id: string
    title: string
    company: string
    location: string | null
  }
}

export function CvOptimizerPage() {
  const [mode, setMode] = useState<OptimizationMode>('job')
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [manualJobDescription, setManualJobDescription] = useState('')
  const [optimizedResult, setOptimizedResult] = useState<{
    optimizedText: string
    changes: Array<{ type: string; section: string; description: string }>
    keywordsAdded: string[]
    summary: string
  } | null>(null)

  const { data: applicationsData, isLoading: applicationsLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: () => applicationsApi.getList({ limit: 100 }),
  })

  const interestingApplications = (applicationsData?.data ?? []).filter((app: Application) =>
    ['INTERESTING', 'CV_PREPARED', 'APPLIED', 'INTERVIEW', 'OFFER'].includes(app.status),
  )

  const optimizeMutation = useMutation({
    mutationFn: () =>
      cvApi.optimize({
        jobId: mode === 'job' ? selectedJobId : undefined,
        jobDescription: mode === 'manual' ? manualJobDescription : undefined,
      }),
    onSuccess: (data) => {
      setOptimizedResult({
        optimizedText: data.optimizedText,
        changes: data.changes,
        keywordsAdded: data.keywordsAdded,
        summary: data.summary,
      })
      toast.success('CV otimizado com sucesso!')
    },
    onError: () => toast.error('Erro ao otimizar CV'),
  })

  const exportPdfMutation = useMutation({
    mutationFn: () =>
      cvApi.exportPdf({
        resumeId: 'default',
        jobId: mode === 'job' ? selectedJobId : undefined,
        optimizedText: optimizedResult?.optimizedText,
      }),
    onError: () => toast.error('Erro ao gerar PDF'),
  })

  const handleOptimize = () => {
    if (mode === 'job' && !selectedJobId) {
      toast.error('Selecione uma vaga')
      return
    }
    if (mode === 'manual' && !manualJobDescription.trim()) {
      toast.error('Cole a descrição da vaga')
      return
    }
    optimizeMutation.mutate()
  }

  const canOptimize = mode === 'job' ? !!selectedJobId : manualJobDescription.trim().length > 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Otimizador de CV para ATS</h1>
        <p className="text-muted-foreground mt-1">
          Otimize seu currículo para uma vaga específica usando IA, mantendo apenas seus dados reais.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selecione a vaga alvo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={mode === 'job' ? 'primary' : 'outline'}
              onClick={() => setMode('job')}
            >
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

              {optimizedResult.keywordsAdded.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Keywords adicionadas:</h3>
                  <div className="flex flex-wrap gap-2">
                    {optimizedResult.keywordsAdded.map((keyword) => (
                      <span
                        key={keyword}
                        className="px-2 py-1 bg-accent/10 text-accent text-xs rounded"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

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
        </>
      )}

      {!optimizedResult && !optimizeMutation.isPending && (
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title="Nenhuma otimização ainda"
          description="Selecione uma vaga ou cole a descrição e clique em 'Otimizar CV' para começar."
        />
      )}
    </div>
  )
}
