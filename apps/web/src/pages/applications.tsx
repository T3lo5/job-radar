import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, ExternalLink, Calendar } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { applicationsApi, jobsApi } from '../services/api'
import { toast } from '../components/ui/toast'
import { ErrorBoundary } from '../components/error-boundary'
import { EmptyState } from '../components/empty-state'
import { Skeleton } from '../components/ui/skeleton'
import { Button } from '../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { FileText } from 'lucide-react'

interface ColumnConfig {
  id: string
  title: string
  color: string
}

const COLUMNS: ColumnConfig[] = [
  { id: 'FOUND', title: 'Encontrada', color: 'bg-surface-2 border-accent' },
  { id: 'INTERESTING', title: 'Interessante', color: 'bg-warning/10 border-warning' },
  { id: 'CV_PREPARED', title: 'CV Preparado', color: 'bg-surface-2 border-accent' },
  { id: 'APPLIED', title: 'Aplicada', color: 'bg-surface-2 border-success' },
  { id: 'INTERVIEW', title: 'Entrevista', color: 'bg-surface-2 border-warning' },
  { id: 'OFFER', title: 'Oferta', color: 'bg-surface-2 border-success' },
  { id: 'REJECTED', title: 'Rejeitada', color: 'bg-error/10 border-error' },
  { id: 'ARCHIVED', title: 'Arquivada', color: 'bg-surface-2 border-muted' },
]

interface ManualJobForm {
  title: string
  company: string
  description: string
  location: string
  remote: string
  seniority: string
  url: string
  applicationStatus: string
}

interface Application {
  id: string
  status: string
  notes: string | null
  appliedAt: string | null
  job: {
    id: string
    title: string
    company: string
    description: string
    location: string | null
    remote: string
    url: string
  }
}

function ApplicationsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="min-w-64 flex-1">
            <div className="mb-3">
              <Skeleton className="h-5 w-24 mb-2" />
              <Skeleton className="h-4 w-8" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-12 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ApplicationsPage() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const createJobMutation = useMutation({
    mutationFn: (data: ManualJobForm) =>
      jobsApi.create({
        title: data.title,
        company: data.company,
        description: data.description,
        location: data.location || null,
        remote: data.remote || 'UNKNOWN',
        seniority: data.seniority || null,
        url: data.url,
        applicationStatus: data.applicationStatus || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      toast.success('Vaga adicionada com sucesso')
      setIsAddDialogOpen(false)
    },
    onError: () => toast.error('Erro ao adicionar vaga'),
  })

  const { data: applications, isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: () => applicationsApi.getList({ limit: 100 }),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      applicationsApi.updateStatus(id, status),
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      toast.success(`Status atualizado para "${COLUMNS.find((c) => c.id === status)?.title ?? status}"`)
    },
    onError: () => toast.error('Erro ao atualizar status'),
  })

  const updateDescriptionMutation = useMutation({
    mutationFn: ({ jobId, description }: { jobId: string; description: string }) =>
      jobsApi.updateDescription(jobId, description),
    onSuccess: (updatedJob) => {
      queryClient.setQueryData(['applications'], (old: { data: Application[] } | undefined) => {
        if (!old?.data) return old
        return {
          ...old,
          data: old.data.map((app) =>
            app.job.id === updatedJob.id
              ? {
                  ...app,
                  job: {
                    ...app.job,
                    description: updatedJob.description,
                  },
                }
              : app,
          ),
        }
      })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      setSelectedApplication((current) => {
        if (!current) return current
        return {
          ...current,
          job: {
            ...current.job,
            description: updatedJob.description,
          },
        }
      })
      setDescriptionDraft(updatedJob.description || '')
      toast.success('Descrição atualizada')
    },
    onError: () => toast.error('Erro ao atualizar descrição'),
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const applicationsList = applications?.data ?? []

  function getApplicationsByStatus(status: string): Application[] {
    return applicationsList.filter((app) => app.status === status)
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeApp = applicationsList.find((a) => a.id === active.id)
    if (!activeApp) return

    let overColumn = COLUMNS.find((col) => col.id === over.id)

    if (!overColumn) {
      const containerId = (over.data as { current?: { sortable?: { containerId?: string } } } | undefined)?.current?.sortable?.containerId
      if (typeof containerId === 'string') {
        overColumn = COLUMNS.find((col) => col.id === containerId)
      }
    }

    if (overColumn && activeApp.status !== overColumn.id) {
      updateStatus.mutate({ id: active.id as string, status: overColumn.id })
    }
  }

  function handleCardClick(application: Application) {
    setSelectedApplication(application)
    setDescriptionDraft(application.job.description || '')
    setIsDetailDialogOpen(true)
  }

  const totalApplications = applicationsList.length

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    createJobMutation.mutate({
      title: formData.get('title') as string,
      company: formData.get('company') as string,
      description: formData.get('description') as string,
      location: (formData.get('location') as string) || '',
      remote: (formData.get('remote') as string) || 'UNKNOWN',
      seniority: (formData.get('seniority') as string) || '',
      url: formData.get('url') as string,
      applicationStatus: (formData.get('applicationStatus') as string) || '',
    })
  }

  const content = () => {
    if (isLoading) return <ApplicationsLoading />

    if (totalApplications === 0) {
      return (
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title="Nenhuma candidatura ainda"
          description="Comece a aplicando para vagas na página de Vagas."
        />
      )
    }

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((column) => {
            const columnApps = getApplicationsByStatus(column.id)
            return (
              <KanbanColumn
                key={column.id}
                id={column.id}
                title={column.title}
                color={column.color}
                applications={columnApps}
                onCardClick={handleCardClick}
              />
            )
          })}
        </div>

        <DragOverlay>
          {activeId ? <ApplicationCard application={applicationsList.find((a) => a.id === activeId)!} overlay /> : null}
        </DragOverlay>
      </DndContext>
    )
  }

  return (
    <ErrorBoundary onRetry={() => window.location.reload()}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-display font-bold">Candidaturas</h1>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                Adicionar vaga
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar vaga manualmente</DialogTitle>
                <DialogDescription>
                  Preencha os dados da vaga para adicioná-la ao quadro de candidaturas.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Título</label>
                  <Input name="title" required placeholder="Ex: Software Engineer" />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Empresa</label>
                  <Input name="company" required placeholder="Ex: Acme Corp" />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Descrição</label>
                  <textarea
                    name="description"
                    required
                    rows={4}
                    className="flex w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    placeholder="Cole a descrição da vaga..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Localização</label>
                    <Input name="location" placeholder="Ex: São Paulo, BR" />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Modalidade</label>
                    <Select name="remote" defaultValue="UNKNOWN">
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UNKNOWN">Não informado</SelectItem>
                        <SelectItem value="REMOTE">Remoto</SelectItem>
                        <SelectItem value="HYBRID">Híbrido</SelectItem>
                        <SelectItem value="ON_SITE">Presencial</SelectItem>
                        <SelectItem value="ANY">Qualquer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Senioridade</label>
                    <Select name="seniority" defaultValue="">
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Não informado</SelectItem>
                        <SelectItem value="INTERN">Estágio</SelectItem>
                        <SelectItem value="JUNIOR">Júnior</SelectItem>
                        <SelectItem value="MID">Pleno</SelectItem>
                        <SelectItem value="SENIOR">Sênior</SelectItem>
                        <SelectItem value="SPECIALIST">Especialista</SelectItem>
                        <SelectItem value="LEAD">Lead</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Status inicial</label>
                    <Select name="applicationStatus" defaultValue="INTERESTING">
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INTERESTING">Interessante</SelectItem>
                        <SelectItem value="CV_PREPARED">CV Preparado</SelectItem>
                        <SelectItem value="APPLIED">Aplicada</SelectItem>
                        <SelectItem value="INTERVIEW">Entrevista</SelectItem>
                        <SelectItem value="OFFER">Oferta</SelectItem>
                        <SelectItem value="REJECTED">Rejeitada</SelectItem>
                        <SelectItem value="ARCHIVED">Arquivada</SelectItem>
                        <SelectItem value="">Não adicionar ao quadro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">URL da vaga</label>
                  <Input name="url" type="url" required placeholder="https://..." />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createJobMutation.isPending}>
                    {createJobMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={isDetailDialogOpen && !!selectedApplication} onOpenChange={(open) => {
          setIsDetailDialogOpen(open)
          if (!open) {
            setSelectedApplication(null)
            setDescriptionDraft('')
          }
        }}>
          <DialogContent className="max-w-2xl w-full">
            <DialogHeader>
              <DialogTitle>{selectedApplication?.job.title}</DialogTitle>
              <DialogDescription>{selectedApplication?.job.company}</DialogDescription>
            </DialogHeader>
            {selectedApplication && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 text-sm">
                  {selectedApplication.job.location && (
                    <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
                      {selectedApplication.job.location}
                    </span>
                  )}
                  <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
                    {selectedApplication.job.remote}
                  </span>
                  {selectedApplication.appliedAt && (
                    <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Aplicou em {new Date(selectedApplication.appliedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-muted-foreground">Descrição</label>
                    {descriptionDraft !== (selectedApplication.job.description || '') && (
                      <Button
                        size="sm"
                        onClick={() =>
                          selectedApplication &&
                          updateDescriptionMutation.mutate({
                            jobId: selectedApplication.job.id,
                            description: descriptionDraft,
                          })
                        }
                        disabled={updateDescriptionMutation.isPending}
                      >
                        {updateDescriptionMutation.isPending ? 'Salvando...' : 'Salvar descrição'}
                      </Button>
                    )}
                  </div>
                  <textarea
                    value={descriptionDraft}
                    onChange={(e) => setDescriptionDraft(e.target.value)}
                    rows={6}
                    className="scrollbar-thin flex w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    placeholder="Cole ou escreva a descrição da vaga..."
                  />
                </div>
                {selectedApplication.notes && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Notas</label>
                    <div className="whitespace-pre-wrap text-sm rounded-[var(--radius-sm)] border border-border bg-surface p-3">
                      {selectedApplication.notes}
                    </div>
                  </div>
                )}
                <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
                  <Button variant="outline" onClick={() => navigate(`/jobs/${selectedApplication.job.id}`)}>
                    Ver detalhes da vaga
                  </Button>
                  <Button asChild>
                    <a href={selectedApplication.job.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Abrir vaga original
                    </a>
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {content()}
      </div>
    </ErrorBoundary>
  )
}

interface KanbanColumnProps {
  id: string
  title: string
  color: string
  applications: Application[]
  onCardClick: (application: Application) => void
}

function KanbanColumn({ id, title, color, applications, onCardClick }: KanbanColumnProps) {
  const { setNodeRef } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`min-w-64 flex-1 rounded-[var(--radius-md)] border-2 p-3 ${color}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-foreground">
          {applications.length}
        </span>
      </div>
      <SortableContext id={id} items={applications.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-[200px] space-y-2">
          {applications.map((app) => (
            <ApplicationCard key={app.id} application={app} onClick={() => onCardClick(app)} />
          ))}
          {applications.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Arraste cards aqui
            </p>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

interface ApplicationCardProps {
  application: Application
  overlay?: boolean
  onClick?: () => void
}

function ApplicationCard({ application, overlay, onClick }: ApplicationCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: application.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  if (!application) return null

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`cursor-grab rounded border border-border bg-surface p-3 shadow-sm active:cursor-grabbing ${
        overlay ? 'ring-2 ring-accent shadow-lg' : ''
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="font-medium text-sm text-foreground">{application.job.title}</div>
      <div className="text-xs text-muted-foreground">{application.job.company}</div>
      {application.job.location && (
        <div className="mt-1 text-xs text-muted-foreground">{application.job.location}</div>
      )}
      {application.appliedAt && (
        <div className="mt-2 text-xs text-muted-foreground">
          Aplicou em {new Date(application.appliedAt).toLocaleDateString()}
        </div>
      )}
    </div>
  )
}
