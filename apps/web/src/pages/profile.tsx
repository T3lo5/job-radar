import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useEffect, useRef } from 'react';
import { UserCircle, Upload, ExternalLink } from 'lucide-react';
import { profileApi } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/empty-state';
import { ErrorBoundary } from '../components/error-boundary';
import { toast } from '../components/ui/toast';
import { cn } from '../lib/utils/cn';
import { REMOTE_MODE_LABELS } from '@job-radar/shared';

const profileSchema = z.object({
  title: z.string().max(200).optional(),
  seniority: z.enum(['INTERN', 'JUNIOR', 'MID', 'SENIOR', 'SPECIALIST', 'LEAD']).optional(),
  seniorityList: z
    .array(z.enum(['INTERN', 'JUNIOR', 'MID', 'SENIOR', 'SPECIALIST', 'LEAD']))
    .optional(),
  location: z.string().max(200).optional(),
  remotePreference: z.enum(['ON_SITE', 'HYBRID', 'REMOTE', 'ANY']).optional(),
  salaryMin: z.coerce.number().int().min(0).optional(),
  salaryMax: z.coerce.number().int().min(0).optional(),
  salaryCurrency: z.string().length(3).optional(),
  summary: z.string().max(5000).optional(),
  jobTypes: z.array(z.string()).optional(),
  focusStacks: z.array(z.string()).optional(),
  discardTerms: z.array(z.string()).optional(),
});

const skillSchema = z.object({
  skillName: z.string().min(1).max(100),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
  yearsExp: z.coerce.number().int().min(0).max(50).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;
type SkillFormData = z.infer<typeof skillSchema>;

const SENIORITY_OPTIONS: {
  value: 'INTERN' | 'JUNIOR' | 'MID' | 'SENIOR' | 'SPECIALIST' | 'LEAD';
  label: string;
}[] = [
  { value: 'INTERN', label: 'Estagiário' },
  { value: 'JUNIOR', label: 'Júnior' },
  { value: 'MID', label: 'Pleno' },
  { value: 'SENIOR', label: 'Sênior' },
  { value: 'SPECIALIST', label: 'Especialista' },
  { value: 'LEAD', label: 'Lead' },
];

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
  'Operations',
  'Business Analyst',
  'Financial Analyst',
];

const LANGUAGE_LEVELS = [
  { value: 'BASIC', label: 'Básico' },
  { value: 'INTERMEDIATE', label: 'Intermediário' },
  { value: 'ADVANCED', label: 'Avançado' },
  { value: 'FLUENT', label: 'Fluente' },
  { value: 'NATIVE', label: 'Nativo' },
];

function ProfileLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Skeleton className="h-8 w-48" />
      <Card>
        <CardContent className="pt-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ProfilePage() {
  const [editing, setEditing] = useState(false);
  const [showSkillForm, setShowSkillForm] = useState(false);
  const [newStack, setNewStack] = useState('');
  const [newJobType, setNewJobType] = useState('');
  const [newDiscardTerm, setNewDiscardTerm] = useState('');
  const [showEducationForm, setShowEducationForm] = useState(false);
  const [editingEducationId, setEditingEducationId] = useState<string | null>(null);
  const [educationForm, setEducationForm] = useState({
    degree: '',
    field: '',
    institution: '',
    startDate: '',
    endDate: '',
  });
  const [showLanguageForm, setShowLanguageForm] = useState(false);
  const [editingLanguageId, setEditingLanguageId] = useState<string | null>(null);
  const [languageForm, setLanguageForm] = useState({ language: '', level: 'INTERMEDIATE' });
  const [showCertificationForm, setShowCertificationForm] = useState(false);
  const [editingCertificationId, setEditingCertificationId] = useState<string | null>(null);
  const [certificationForm, setCertificationForm] = useState({
    name: '',
    issuer: '',
    issuedAt: '',
    expiresAt: '',
    credentialId: '',
    url: '',
  });
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    url: '',
    skills: '',
  });
  const [showWorkExperienceForm, setShowWorkExperienceForm] = useState(false);
  const [editingWorkExperienceId, setEditingWorkExperienceId] = useState<string | null>(null);
  const [workExperienceForm, setWorkExperienceForm] = useState({
    company: '',
    role: '',
    description: '',
    startDate: '',
    endDate: '',
    current: false,
    skills: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => profileApi.get().catch(() => null),
  });

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      title: profile?.title ?? '',
      seniority: profile?.seniority as any,
      seniorityList: (profile?.seniorityList as any) ?? [],
      location: profile?.location ?? '',
      remotePreference: profile?.remotePreference as any,
      salaryMin: profile?.salaryMin ?? undefined,
      salaryMax: profile?.salaryMax ?? undefined,
      salaryCurrency: profile?.salaryCurrency ?? 'BRL',
      summary: profile?.summary ?? '',
      jobTypes: profile?.jobTypes ?? [],
      focusStacks: profile?.focusStacks ?? [],
      discardTerms: profile?.discardTerms ?? [],
    },
  });

  useEffect(() => {
    if (profile) {
      profileForm.reset({
        title: profile.title ?? '',
        seniority: profile.seniority as any,
        seniorityList: (profile.seniorityList as any) ?? [],
        location: profile.location ?? '',
        remotePreference: profile.remotePreference as any,
        salaryMin: profile.salaryMin ?? undefined,
        salaryMax: profile.salaryMax ?? undefined,
        salaryCurrency: profile.salaryCurrency ?? 'BRL',
        summary: profile.summary ?? '',
        jobTypes: profile.jobTypes ?? [],
        focusStacks: profile.focusStacks ?? [],
        discardTerms: profile.discardTerms ?? [],
      });
    }
  }, [profile, profileForm]);

  const skillForm = useForm<SkillFormData>({
    resolver: zodResolver(skillSchema),
    defaultValues: { skillName: '', level: 'INTERMEDIATE', yearsExp: undefined },
  });

  const updateProfile = useMutation({
    mutationFn: (data: ProfileFormData) => profileApi.update(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setEditing(false);
      toast.success('Perfil atualizado com sucesso');
    },
    onError: () => toast.error('Erro ao atualizar perfil'),
  });

  const addSkill = useMutation({
    mutationFn: (data: SkillFormData) =>
      profileApi.addSkill(data.skillName, data.level, data.yearsExp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      skillForm.reset();
      setShowSkillForm(false);
      toast.success('Skill adicionada');
    },
    onError: () => toast.error('Erro ao adicionar skill'),
  });

  const removeSkill = useMutation({
    mutationFn: (id: string) => profileApi.removeSkill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Skill removida');
    },
    onError: () => toast.error('Erro ao remover skill'),
  });

  const addEducation = useMutation({
    mutationFn: (data: {
      degree: string;
      field: string;
      institution: string;
      startDate?: string | null;
      endDate?: string | null;
    }) => profileApi.addEducation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setShowEducationForm(false);
      setEducationForm({ degree: '', field: '', institution: '', startDate: '', endDate: '' });
      toast.success('Formação adicionada');
    },
    onError: () => toast.error('Erro ao adicionar formação'),
  });

  const updateEducation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        degree: string;
        field: string;
        institution: string;
        startDate?: string | null;
        endDate?: string | null;
      };
    }) => profileApi.updateEducation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setEditingEducationId(null);
      toast.success('Formação atualizada');
    },
    onError: () => toast.error('Erro ao atualizar formação'),
  });

  const removeEducation = useMutation({
    mutationFn: (id: string) => profileApi.removeEducation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Formação removida');
    },
    onError: () => toast.error('Erro ao remover formação'),
  });

  const addLanguage = useMutation({
    mutationFn: (data: { language: string; level: string }) => profileApi.addLanguage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setShowLanguageForm(false);
      setLanguageForm({ language: '', level: 'INTERMEDIATE' });
      toast.success('Idioma adicionado');
    },
    onError: () => toast.error('Erro ao adicionar idioma'),
  });

  const updateLanguage = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { language: string; level: string } }) =>
      profileApi.updateLanguage(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setEditingLanguageId(null);
      toast.success('Idioma atualizado');
    },
    onError: () => toast.error('Erro ao atualizar idioma'),
  });

  const removeLanguage = useMutation({
    mutationFn: (id: string) => profileApi.removeLanguage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Idioma removido');
    },
    onError: () => toast.error('Erro ao remover idioma'),
  });

  const addCertification = useMutation({
    mutationFn: (data: {
      name: string;
      issuer?: string | null;
      issuedAt?: string | null;
      expiresAt?: string | null;
      credentialId?: string | null;
      url?: string | null;
    }) => profileApi.addCertification(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setShowCertificationForm(false);
      setCertificationForm({
        name: '',
        issuer: '',
        issuedAt: '',
        expiresAt: '',
        credentialId: '',
        url: '',
      });
      toast.success('Certificação adicionada');
    },
    onError: () => toast.error('Erro ao adicionar certificação'),
  });

  const updateCertification = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        name: string;
        issuer?: string | null;
        issuedAt?: string | null;
        expiresAt?: string | null;
        credentialId?: string | null;
        url?: string | null;
      };
    }) => profileApi.updateCertification(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setEditingCertificationId(null);
      toast.success('Certificação atualizada');
    },
    onError: () => toast.error('Erro ao atualizar certificação'),
  });

  const removeCertification = useMutation({
    mutationFn: (id: string) => profileApi.removeCertification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Certificação removida');
    },
    onError: () => toast.error('Erro ao remover certificação'),
  });

  const addProject = useMutation({
    mutationFn: (data: {
      name: string;
      description?: string | null;
      url?: string | null;
      skills?: string[];
    }) => profileApi.addProject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setShowProjectForm(false);
      setProjectForm({ name: '', description: '', url: '', skills: '' });
      toast.success('Projeto adicionado');
    },
    onError: () => toast.error('Erro ao adicionar projeto'),
  });

  const updateProject = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { name: string; description?: string | null; url?: string | null; skills?: string[] };
    }) => profileApi.updateProject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setEditingProjectId(null);
      toast.success('Projeto atualizado');
    },
    onError: () => toast.error('Erro ao atualizar projeto'),
  });

  const removeProject = useMutation({
    mutationFn: (id: string) => profileApi.removeProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Projeto removido');
    },
    onError: () => toast.error('Erro ao remover projeto'),
  });

  const addWorkExperience = useMutation({
    mutationFn: (data: {
      company: string;
      role: string;
      description?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      current?: boolean;
      skills?: string[];
    }) => profileApi.addWorkExperience(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setShowWorkExperienceForm(false);
      setWorkExperienceForm({
        company: '',
        role: '',
        description: '',
        startDate: '',
        endDate: '',
        current: false,
        skills: '',
      });
      toast.success('Experiência adicionada');
    },
    onError: () => toast.error('Erro ao adicionar experiência'),
  });

  const updateWorkExperience = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        company: string;
        role: string;
        description?: string | null;
        startDate?: string | null;
        endDate?: string | null;
        current?: boolean;
        skills?: string[];
      };
    }) => profileApi.updateWorkExperience(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setEditingWorkExperienceId(null);
      toast.success('Experiência atualizada');
    },
    onError: () => toast.error('Erro ao atualizar experiência'),
  });

  const removeWorkExperience = useMutation({
    mutationFn: (id: string) => profileApi.removeWorkExperience(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Experiência removida');
    },
    onError: () => toast.error('Erro ao remover experiência'),
  });

  const uploadResumeMutation = useMutation({
    mutationFn: async (file: File) => {
      const result = await profileApi.uploadResume(file);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('CV enviado com sucesso');
    },
    onError: () => toast.error('Erro ao enviar CV'),
  });

  const watchedSeniority = profileForm.watch('seniorityList');
  const watchedJobTypes = profileForm.watch('jobTypes');
  const watchedStacks = profileForm.watch('focusStacks');
  const watchedDiscardTerms = profileForm.watch('discardTerms');

  const toggleSeniority = (
    value: 'INTERN' | 'JUNIOR' | 'MID' | 'SENIOR' | 'SPECIALIST' | 'LEAD',
  ) => {
    const current = watchedSeniority ?? [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    profileForm.setValue('seniorityList', updated);
  };

  const toggleJobType = (value: string) => {
    const current = watchedJobTypes ?? [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    profileForm.setValue('jobTypes', updated);
  };

  const addCustomJobType = () => {
    if (!newJobType.trim()) return;
    const trimmed = newJobType.trim();
    const current = watchedJobTypes ?? [];
    if (!current.includes(trimmed)) {
      profileForm.setValue('jobTypes', [...current, trimmed]);
    }
    setNewJobType('');
  };

  const addStack = () => {
    if (!newStack.trim()) return;
    const current = watchedStacks ?? [];
    if (!current.includes(newStack.trim())) {
      profileForm.setValue('focusStacks', [...current, newStack.trim()]);
    }
    setNewStack('');
  };

  const removeStack = (stack: string) => {
    const current = watchedStacks ?? [];
    profileForm.setValue(
      'focusStacks',
      current.filter((s) => s !== stack),
    );
  };

  const addDiscardTerm = () => {
    if (!newDiscardTerm.trim()) return;
    const current = watchedDiscardTerms ?? [];
    if (!current.includes(newDiscardTerm.trim())) {
      profileForm.setValue('discardTerms', [...current, newDiscardTerm.trim()]);
    }
    setNewDiscardTerm('');
  };

  const removeDiscardTerm = (term: string) => {
    const current = watchedDiscardTerms ?? [];
    profileForm.setValue(
      'discardTerms',
      current.filter((t) => t !== term),
    );
  };

  if (isLoading) {
    return <ProfileLoading />;
  }

  if (!profile) {
    return (
      <ErrorBoundary onRetry={() => window.location.reload()}>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-display font-bold mb-6">Perfil</h1>
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                icon={<UserCircle className="h-16 w-16" />}
                title="Nenhum perfil configurado"
                description="Configure seu perfil para começar a receber matches de vagas personalizados."
                action={
                  <Button variant="primary" onClick={() => setEditing(true)}>
                    Criar Perfil
                  </Button>
                }
              />
            </CardContent>
          </Card>

          {editing && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Criar Perfil</CardTitle>
              </CardHeader>
              <CardContent>
                <ProfileForm
                  form={profileForm}
                  onSubmit={(data) => updateProfile.mutate(data)}
                  seniorityOptions={SENIORITY_OPTIONS}
                  jobTypeOptions={JOB_TYPE_OPTIONS}
                  watchedSeniority={watchedSeniority}
                  watchedJobTypes={watchedJobTypes}
                  watchedStacks={watchedStacks}
                  watchedDiscardTerms={watchedDiscardTerms}
                  toggleSeniority={toggleSeniority}
                  toggleJobType={toggleJobType}
                  newJobType={newJobType}
                  setNewJobType={setNewJobType}
                  addCustomJobType={addCustomJobType}
                  newStack={newStack}
                  setNewStack={setNewStack}
                  addStack={addStack}
                  removeStack={removeStack}
                  newDiscardTerm={newDiscardTerm}
                  setNewDiscardTerm={setNewDiscardTerm}
                  addDiscardTerm={addDiscardTerm}
                  removeDiscardTerm={removeDiscardTerm}
                  isPending={updateProfile.isPending}
                  onCancel={() => setEditing(false)}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary onRetry={() => window.location.reload()}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-display font-bold">Perfil</h1>
          <Button variant={editing ? 'ghost' : 'outline'} onClick={() => setEditing(!editing)}>
            {editing ? 'Cancelar' : 'Editar'}
          </Button>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações Gerais</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <ProfileForm
                  key={profile ? 'loaded' : 'loading'}
                  form={profileForm}
                  onSubmit={(data) => updateProfile.mutate(data)}
                  seniorityOptions={SENIORITY_OPTIONS}
                  jobTypeOptions={JOB_TYPE_OPTIONS}
                  watchedSeniority={watchedSeniority}
                  watchedJobTypes={watchedJobTypes}
                  watchedStacks={watchedStacks}
                  watchedDiscardTerms={watchedDiscardTerms}
                  toggleSeniority={toggleSeniority}
                  toggleJobType={toggleJobType}
                  newJobType={newJobType}
                  setNewJobType={setNewJobType}
                  addCustomJobType={addCustomJobType}
                  newStack={newStack}
                  setNewStack={setNewStack}
                  addStack={addStack}
                  removeStack={removeStack}
                  newDiscardTerm={newDiscardTerm}
                  setNewDiscardTerm={setNewDiscardTerm}
                  addDiscardTerm={addDiscardTerm}
                  removeDiscardTerm={removeDiscardTerm}
                  isPending={updateProfile.isPending}
                  onCancel={() => setEditing(false)}
                />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <InfoRow label="Cargo" value={profile.title} />
                  <InfoRow
                    label="Tipos de cargo"
                    value={profile.jobTypes?.length ? profile.jobTypes.join(', ') : null}
                  />
                  <InfoRow
                    label="Senioridade"
                    value={profile.seniorityList?.join(', ') ?? profile.seniority ?? '-'}
                  />
                  <InfoRow label="Localização" value={profile.location} />
                  <InfoRow
                    label="Modalidade"
                    value={
                      REMOTE_MODE_LABELS[
                        profile.remotePreference?.toLowerCase() as keyof typeof REMOTE_MODE_LABELS
                      ]?.label ?? profile.remotePreference
                    }
                  />
                  <InfoRow
                    label="Salário"
                    value={
                      profile.salaryMin && profile.salaryMax
                        ? `${profile.salaryMin} - ${profile.salaryMax} ${profile.salaryCurrency}`
                        : null
                    }
                  />
                  {profile.summary && (
                    <div className="md:col-span-2">
                      <span className="text-sm font-medium text-muted-foreground">Resumo</span>
                      <p className="mt-1">{profile.summary}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Skills</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowSkillForm(!showSkillForm)}>
                {showSkillForm ? 'Cancelar' : '+ Adicionar'}
              </Button>
            </CardHeader>
            <CardContent>
              {showSkillForm && (
                <form
                  onSubmit={skillForm.handleSubmit((data) => addSkill.mutate(data))}
                  className="mb-4 flex flex-wrap gap-2"
                >
                  <Input
                    {...skillForm.register('skillName')}
                    placeholder="Nome da skill"
                    className="w-48"
                  />
                  <Select
                    value={skillForm.watch('level')}
                    onValueChange={(value: string) => skillForm.setValue('level', value as any)}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BEGINNER">Iniciante</SelectItem>
                      <SelectItem value="INTERMEDIATE">Intermediário</SelectItem>
                      <SelectItem value="ADVANCED">Avançado</SelectItem>
                      <SelectItem value="EXPERT">Especialista</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    {...skillForm.register('yearsExp')}
                    placeholder="Anos"
                    className="w-20"
                  />
                  <Button type="submit" size="sm" disabled={addSkill.isPending}>
                    {addSkill.isPending ? 'Adicionando...' : 'Adicionar'}
                  </Button>
                </form>
              )}
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((ps) => (
                  <span
                    key={ps.id}
                    className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success px-3 py-1 text-sm"
                  >
                    {ps.skill.name} ({ps.level}
                    {ps.yearsExp ? `, ${ps.yearsExp}y` : ''})
                    <button
                      onClick={() => removeSkill.mutate(ps.id)}
                      className="ml-1 text-success/60 hover:text-error"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {profile.skills.length === 0 && !showSkillForm && (
                  <span className="text-muted-foreground">Nenhuma skill adicionada</span>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Idiomas</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLanguageForm(!showLanguageForm)}
                >
                  {showLanguageForm ? 'Cancelar' : '+ Adicionar'}
                </Button>
              </CardHeader>
              <CardContent>
                {showLanguageForm && (
                  <div className="mb-4 p-4 rounded-[var(--radius-md)] bg-surface-2 border border-border">
                    <div className="grid gap-3">
                      <div>
                        <label className="text-sm font-medium">Idioma</label>
                        <Input
                          value={languageForm.language}
                          onChange={(e) =>
                            setLanguageForm({ ...languageForm, language: e.target.value })
                          }
                          placeholder="Inglês, Espanhol..."
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Nível</label>
                        <Select
                          value={languageForm.level}
                          onValueChange={(value: string) =>
                            setLanguageForm({ ...languageForm, level: value })
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LANGUAGE_LEVELS.map((l) => (
                              <SelectItem key={l.value} value={l.value}>
                                {l.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => addLanguage.mutate(languageForm)}
                        disabled={!languageForm.language.trim() || addLanguage.isPending}
                      >
                        {addLanguage.isPending ? 'Adicionando...' : 'Adicionar'}
                      </Button>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {profile.languages.map((lang) => (
                    <div key={lang.id} className="inline-flex items-center gap-1">
                      {editingLanguageId === lang.id ? (
                        <div className="inline-flex items-center gap-1">
                          <Input
                            value={languageForm.language}
                            onChange={(e) =>
                              setLanguageForm({ ...languageForm, language: e.target.value })
                            }
                            className="h-7 w-24 text-xs"
                          />
                          <Select
                            value={languageForm.level}
                            onValueChange={(value) =>
                              setLanguageForm({ ...languageForm, level: value })
                            }
                          >
                            <SelectTrigger className="h-7 w-24 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {LANGUAGE_LEVELS.map((l) => (
                                <SelectItem key={l.value} value={l.value}>
                                  {l.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <button
                            onClick={() =>
                              updateLanguage.mutate({ id: lang.id, data: languageForm })
                            }
                            className="text-success text-sm"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setEditingLanguageId(null)}
                            className="text-muted-foreground hover:text-foreground text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <span
                          className="inline-flex items-center rounded-full bg-surface-2 px-3 py-1 text-sm text-foreground cursor-pointer hover:bg-surface"
                          onClick={() => {
                            setEditingLanguageId(lang.id);
                            setLanguageForm({ language: lang.language, level: lang.level });
                          }}
                        >
                          {lang.language} ({lang.level})
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeLanguage.mutate(lang.id);
                            }}
                            className="ml-2 text-muted-foreground/70 hover:text-error"
                          >
                            ×
                          </button>
                        </span>
                      )}
                    </div>
                  ))}
                  {profile.languages.length === 0 && !showLanguageForm && (
                    <span className="text-muted-foreground">Nenhum idioma adicionado</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Educação</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEducationForm(!showEducationForm)}
                >
                  {showEducationForm ? 'Cancelar' : '+ Adicionar'}
                </Button>
              </CardHeader>
              <CardContent>
                {showEducationForm && (
                  <div className="mb-4 p-4 rounded-[var(--radius-md)] bg-surface-2 border border-border">
                    <div className="grid gap-3">
                      <div>
                        <label className="text-sm font-medium">Curso/Grau</label>
                        <Input
                          value={educationForm.degree}
                          onChange={(e) =>
                            setEducationForm({ ...educationForm, degree: e.target.value })
                          }
                          placeholder="Bacharelado, Técnico, MBA..."
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Área de estudo</label>
                        <Input
                          value={educationForm.field}
                          onChange={(e) =>
                            setEducationForm({ ...educationForm, field: e.target.value })
                          }
                          placeholder="Ciência da Computação, Engenharia..."
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Instituição</label>
                        <Input
                          value={educationForm.institution}
                          onChange={(e) =>
                            setEducationForm({ ...educationForm, institution: e.target.value })
                          }
                          placeholder="USP, MIT, Udemy..."
                          className="mt-1"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => addEducation.mutate(educationForm)}
                          disabled={
                            !educationForm.degree.trim() ||
                            !educationForm.field.trim() ||
                            !educationForm.institution.trim() ||
                            addEducation.isPending
                          }
                        >
                          {addEducation.isPending ? 'Adicionando...' : 'Adicionar'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {profile.education.map((edu) => (
                    <div
                      key={edu.id}
                      className="text-sm bg-surface-2 rounded border border-border p-3"
                    >
                      {editingEducationId === edu.id ? (
                        <div className="grid gap-2">
                          <Input
                            value={educationForm.degree}
                            onChange={(e) =>
                              setEducationForm({ ...educationForm, degree: e.target.value })
                            }
                            placeholder="Curso/Grau"
                            className="h-8 text-sm"
                          />
                          <Input
                            value={educationForm.field}
                            onChange={(e) =>
                              setEducationForm({ ...educationForm, field: e.target.value })
                            }
                            placeholder="Área de estudo"
                            className="h-8 text-sm"
                          />
                          <Input
                            value={educationForm.institution}
                            onChange={(e) =>
                              setEducationForm({ ...educationForm, institution: e.target.value })
                            }
                            placeholder="Instituição"
                            className="h-8 text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                updateEducation.mutate({ id: edu.id, data: educationForm })
                              }
                              className="text-success text-sm"
                            >
                              ✓ Salvar
                            </button>
                            <button
                              onClick={() => setEditingEducationId(null)}
                              className="text-muted-foreground hover:text-foreground text-sm"
                            >
                              ✕ Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="cursor-pointer"
                          onClick={() => {
                            setEditingEducationId(edu.id);
                            setEducationForm({
                              degree: edu.degree,
                              field: edu.field ?? '',
                              institution: edu.institution,
                              startDate: edu.startDate ?? '',
                              endDate: edu.endDate ?? '',
                            });
                          }}
                        >
                          <strong className="text-foreground">{edu.degree}</strong>
                          <span className="text-muted-foreground">
                            {' '}
                            em {edu.field} - {edu.institution}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeEducation.mutate(edu.id);
                            }}
                            className="ml-2 text-muted-foreground/70 hover:text-error"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {profile.education.length === 0 && !showEducationForm && (
                    <span className="text-muted-foreground">Nenhuma formação adicionada</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Currículo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadResumeMutation.isPending}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    {uploadResumeMutation.isPending ? 'Enviando...' : 'Enviar CV'}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        uploadResumeMutation.mutate(file);
                      }
                    }}
                  />
                  {profile.certifications && (
                    <span className="text-xs text-muted-foreground">
                      Formatos aceitos: PDF, DOC, DOCX, TXT
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Certificações</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCertificationForm(!showCertificationForm)}
              >
                {showCertificationForm ? 'Cancelar' : '+ Adicionar'}
              </Button>
            </CardHeader>
            <CardContent>
              {showCertificationForm && (
                <div className="mb-4 p-4 rounded-[var(--radius-md)] bg-surface-2 border border-border">
                  <div className="grid gap-3">
                    <div>
                      <label className="text-sm font-medium">Nome</label>
                      <Input
                        value={certificationForm.name}
                        onChange={(e) =>
                          setCertificationForm({ ...certificationForm, name: e.target.value })
                        }
                        placeholder="AWS Certified Solutions Architect"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Emissor</label>
                      <Input
                        value={certificationForm.issuer}
                        onChange={(e) =>
                          setCertificationForm({ ...certificationForm, issuer: e.target.value })
                        }
                        placeholder="Amazon Web Services"
                        className="mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium">Data de emissão</label>
                        <Input
                          type="date"
                          value={certificationForm.issuedAt}
                          onChange={(e) =>
                            setCertificationForm({ ...certificationForm, issuedAt: e.target.value })
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Validade</label>
                        <Input
                          type="date"
                          value={certificationForm.expiresAt}
                          onChange={(e) =>
                            setCertificationForm({
                              ...certificationForm,
                              expiresAt: e.target.value,
                            })
                          }
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Credencial ID</label>
                      <Input
                        value={certificationForm.credentialId}
                        onChange={(e) =>
                          setCertificationForm({
                            ...certificationForm,
                            credentialId: e.target.value,
                          })
                        }
                        placeholder="ABC-123-XYZ"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">URL</label>
                      <Input
                        value={certificationForm.url}
                        onChange={(e) =>
                          setCertificationForm({ ...certificationForm, url: e.target.value })
                        }
                        placeholder="https://..."
                        className="mt-1"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() => addCertification.mutate(certificationForm)}
                      disabled={!certificationForm.name.trim() || addCertification.isPending}
                    >
                      {addCertification.isPending ? 'Adicionando...' : 'Adicionar'}
                    </Button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {profile.certifications?.map((cert) => (
                  <div
                    key={cert.id}
                    className="text-sm bg-surface-2 rounded border border-border p-3"
                  >
                    {editingCertificationId === cert.id ? (
                      <div className="grid gap-2">
                        <Input
                          value={certificationForm.name}
                          onChange={(e) =>
                            setCertificationForm({ ...certificationForm, name: e.target.value })
                          }
                          placeholder="Nome"
                          className="h-8 text-sm"
                        />
                        <Input
                          value={certificationForm.issuer}
                          onChange={(e) =>
                            setCertificationForm({ ...certificationForm, issuer: e.target.value })
                          }
                          placeholder="Emissor"
                          className="h-8 text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              updateCertification.mutate({ id: cert.id, data: certificationForm })
                            }
                            className="text-success text-sm"
                          >
                            ✓ Salvar
                          </button>
                          <button
                            onClick={() => setEditingCertificationId(null)}
                            className="text-muted-foreground hover:text-foreground text-sm"
                          >
                            ✕ Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="cursor-pointer"
                        onClick={() => {
                          setEditingCertificationId(cert.id);
                          setCertificationForm({
                            name: cert.name,
                            issuer: cert.issuer ?? '',
                            issuedAt: cert.issuedAt ?? '',
                            expiresAt: cert.expiresAt ?? '',
                            credentialId: cert.credentialId ?? '',
                            url: cert.url ?? '',
                          });
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <strong className="text-foreground">{cert.name}</strong>
                            {cert.issuer && (
                              <span className="text-muted-foreground"> - {cert.issuer}</span>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCertification.mutate(cert.id);
                            }}
                            className="text-muted-foreground/70 hover:text-error"
                          >
                            ×
                          </button>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {cert.issuedAt && (
                            <span>Emitido em {new Date(cert.issuedAt).toLocaleDateString()}</span>
                          )}
                          {cert.expiresAt && (
                            <span className="ml-2">
                              Vence em {new Date(cert.expiresAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {cert.url && (
                          <a
                            href={cert.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-accent hover:underline mt-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Ver credencial
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {(!profile.certifications || profile.certifications.length === 0) &&
                  !showCertificationForm && (
                    <span className="text-muted-foreground">Nenhuma certificação adicionada</span>
                  )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Projetos</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowProjectForm(!showProjectForm)}
              >
                {showProjectForm ? 'Cancelar' : '+ Adicionar'}
              </Button>
            </CardHeader>
            <CardContent>
              {showProjectForm && (
                <div className="mb-4 p-4 rounded-[var(--radius-md)] bg-surface-2 border border-border">
                  <div className="grid gap-3">
                    <div>
                      <label className="text-sm font-medium">Nome</label>
                      <Input
                        value={projectForm.name}
                        onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                        placeholder="Meu Projeto"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Descrição</label>
                      <textarea
                        value={projectForm.description}
                        onChange={(e) =>
                          setProjectForm({ ...projectForm, description: e.target.value })
                        }
                        rows={3}
                        className="flex w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 mt-1"
                        placeholder="Descreva o projeto..."
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">URL</label>
                      <Input
                        value={projectForm.url}
                        onChange={(e) => setProjectForm({ ...projectForm, url: e.target.value })}
                        placeholder="https://github.com/..."
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Skills (separadas por vírgula)</label>
                      <Input
                        value={projectForm.skills}
                        onChange={(e) => setProjectForm({ ...projectForm, skills: e.target.value })}
                        placeholder="React, Node.js, TypeScript"
                        className="mt-1"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() =>
                        addProject.mutate({
                          name: projectForm.name,
                          description: projectForm.description || null,
                          url: projectForm.url || null,
                          skills: projectForm.skills
                            ? projectForm.skills
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean)
                            : [],
                        })
                      }
                      disabled={!projectForm.name.trim() || addProject.isPending}
                    >
                      {addProject.isPending ? 'Adicionando...' : 'Adicionar'}
                    </Button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {profile.projects?.map((proj) => (
                  <div
                    key={proj.id}
                    className="text-sm bg-surface-2 rounded border border-border p-3"
                  >
                    {editingProjectId === proj.id ? (
                      <div className="grid gap-2">
                        <Input
                          value={projectForm.name}
                          onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                          placeholder="Nome"
                          className="h-8 text-sm"
                        />
                        <textarea
                          value={projectForm.description}
                          onChange={(e) =>
                            setProjectForm({ ...projectForm, description: e.target.value })
                          }
                          rows={2}
                          className="flex w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                          placeholder="Descrição"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              updateProject.mutate({
                                id: proj.id,
                                data: {
                                  ...projectForm,
                                  skills: projectForm.skills
                                    ? projectForm.skills
                                        .split(',')
                                        .map((s) => s.trim())
                                        .filter(Boolean)
                                    : [],
                                },
                              })
                            }
                            className="text-success text-sm"
                          >
                            ✓ Salvar
                          </button>
                          <button
                            onClick={() => setEditingProjectId(null)}
                            className="text-muted-foreground hover:text-foreground text-sm"
                          >
                            ✕ Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="cursor-pointer"
                        onClick={() => {
                          setEditingProjectId(proj.id);
                          setProjectForm({
                            name: proj.name,
                            description: proj.description ?? '',
                            url: proj.url ?? '',
                            skills: proj.skills?.join(', ') ?? '',
                          });
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <strong className="text-foreground">{proj.name}</strong>
                            {proj.url && (
                              <a
                                href={proj.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-accent hover:underline ml-2"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Link
                              </a>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeProject.mutate(proj.id);
                            }}
                            className="text-muted-foreground/70 hover:text-error"
                          >
                            ×
                          </button>
                        </div>
                        {proj.description && (
                          <p className="mt-1 text-xs text-muted-foreground">{proj.description}</p>
                        )}
                        {proj.skills?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {proj.skills.map((skill) => (
                              <span
                                key={skill}
                                className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-xs text-foreground"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {(!profile.projects || profile.projects.length === 0) && !showProjectForm && (
                  <span className="text-muted-foreground">Nenhum projeto adicionado</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Experiência Profissional</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowWorkExperienceForm(!showWorkExperienceForm)}
              >
                {showWorkExperienceForm ? 'Cancelar' : '+ Adicionar'}
              </Button>
            </CardHeader>
            <CardContent>
              {showWorkExperienceForm && (
                <div className="mb-4 p-4 rounded-[var(--radius-md)] bg-surface-2 border border-border">
                  <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium">Empresa</label>
                        <Input
                          value={workExperienceForm.company}
                          onChange={(e) =>
                            setWorkExperienceForm({
                              ...workExperienceForm,
                              company: e.target.value,
                            })
                          }
                          placeholder="Acme Corp"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Cargo</label>
                        <Input
                          value={workExperienceForm.role}
                          onChange={(e) =>
                            setWorkExperienceForm({ ...workExperienceForm, role: e.target.value })
                          }
                          placeholder="Software Engineer"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Descrição</label>
                      <textarea
                        value={workExperienceForm.description}
                        onChange={(e) =>
                          setWorkExperienceForm({
                            ...workExperienceForm,
                            description: e.target.value,
                          })
                        }
                        rows={3}
                        className="flex w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 mt-1"
                        placeholder="Descreva suas responsabilidades..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium">Data de início</label>
                        <Input
                          type="date"
                          value={workExperienceForm.startDate}
                          onChange={(e) =>
                            setWorkExperienceForm({
                              ...workExperienceForm,
                              startDate: e.target.value,
                            })
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Data de término</label>
                        <Input
                          type="date"
                          value={workExperienceForm.endDate}
                          onChange={(e) =>
                            setWorkExperienceForm({
                              ...workExperienceForm,
                              endDate: e.target.value,
                            })
                          }
                          disabled={workExperienceForm.current}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="current-work"
                        checked={workExperienceForm.current}
                        onChange={(e) =>
                          setWorkExperienceForm({
                            ...workExperienceForm,
                            current: e.target.checked,
                          })
                        }
                        className="rounded border-border"
                      />
                      <label htmlFor="current-work" className="text-sm font-medium">
                        Trabalho atual
                      </label>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Skills (separadas por vírgula)</label>
                      <Input
                        value={workExperienceForm.skills}
                        onChange={(e) =>
                          setWorkExperienceForm({ ...workExperienceForm, skills: e.target.value })
                        }
                        placeholder="React, Node.js, AWS"
                        className="mt-1"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() =>
                        addWorkExperience.mutate({
                          company: workExperienceForm.company,
                          role: workExperienceForm.role,
                          description: workExperienceForm.description || null,
                          startDate: workExperienceForm.startDate || null,
                          endDate: workExperienceForm.current
                            ? null
                            : workExperienceForm.endDate || null,
                          current: workExperienceForm.current,
                          skills: workExperienceForm.skills
                            ? workExperienceForm.skills
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean)
                            : [],
                        })
                      }
                      disabled={
                        !workExperienceForm.company.trim() ||
                        !workExperienceForm.role.trim() ||
                        addWorkExperience.isPending
                      }
                    >
                      {addWorkExperience.isPending ? 'Adicionando...' : 'Adicionar'}
                    </Button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {profile.workExperiences?.map((exp) => (
                  <div
                    key={exp.id}
                    className="text-sm bg-surface-2 rounded border border-border p-3"
                  >
                    {editingWorkExperienceId === exp.id ? (
                      <div className="grid gap-2">
                        <Input
                          value={workExperienceForm.company}
                          onChange={(e) =>
                            setWorkExperienceForm({
                              ...workExperienceForm,
                              company: e.target.value,
                            })
                          }
                          placeholder="Empresa"
                          className="h-8 text-sm"
                        />
                        <Input
                          value={workExperienceForm.role}
                          onChange={(e) =>
                            setWorkExperienceForm({ ...workExperienceForm, role: e.target.value })
                          }
                          placeholder="Cargo"
                          className="h-8 text-sm"
                        />
                        <textarea
                          value={workExperienceForm.description}
                          onChange={(e) =>
                            setWorkExperienceForm({
                              ...workExperienceForm,
                              description: e.target.value,
                            })
                          }
                          rows={2}
                          className="flex w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                          placeholder="Descrição"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              updateWorkExperience.mutate({
                                id: exp.id,
                                data: {
                                  ...workExperienceForm,
                                  skills: workExperienceForm.skills
                                    ? workExperienceForm.skills
                                        .split(',')
                                        .map((s) => s.trim())
                                        .filter(Boolean)
                                    : [],
                                },
                              })
                            }
                            className="text-success text-sm"
                          >
                            ✓ Salvar
                          </button>
                          <button
                            onClick={() => setEditingWorkExperienceId(null)}
                            className="text-muted-foreground hover:text-foreground text-sm"
                          >
                            ✕ Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="cursor-pointer"
                        onClick={() => {
                          setEditingWorkExperienceId(exp.id);
                          setWorkExperienceForm({
                            company: exp.company,
                            role: exp.role,
                            description: exp.description ?? '',
                            startDate: exp.startDate ?? '',
                            endDate: exp.endDate ?? '',
                            current: exp.current,
                            skills: exp.skills?.join(', ') ?? '',
                          });
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <strong className="text-foreground">{exp.role}</strong>
                            <span className="text-muted-foreground"> - {exp.company}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeWorkExperience.mutate(exp.id);
                            }}
                            className="text-muted-foreground/70 hover:text-error"
                          >
                            ×
                          </button>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {exp.startDate && (
                            <span>Início: {new Date(exp.startDate).toLocaleDateString()}</span>
                          )}
                          {!exp.current && exp.endDate && (
                            <span className="ml-2">
                              Término: {new Date(exp.endDate).toLocaleDateString()}
                            </span>
                          )}
                          {exp.current && <span className="ml-2">Atual</span>}
                        </div>
                        {exp.description && (
                          <p className="mt-1 text-xs text-muted-foreground">{exp.description}</p>
                        )}
                        {exp.skills?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {exp.skills.map((skill) => (
                              <span
                                key={skill}
                                className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-xs text-foreground"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {(!profile.workExperiences || profile.workExperiences.length === 0) &&
                  !showWorkExperienceForm && (
                    <span className="text-muted-foreground">
                      Nenhuma experiência profissional adicionada
                    </span>
                  )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ErrorBoundary>
  );
}

function ProfileForm({
  form,
  onSubmit,
  seniorityOptions,
  jobTypeOptions,
  watchedSeniority,
  watchedJobTypes,
  watchedStacks,
  watchedDiscardTerms,
  toggleSeniority,
  toggleJobType,
  newJobType,
  setNewJobType,
  addCustomJobType,
  newStack,
  setNewStack,
  addStack,
  removeStack,
  newDiscardTerm,
  setNewDiscardTerm,
  addDiscardTerm,
  removeDiscardTerm,
  isPending,
  onCancel,
}: {
  form: any;
  onSubmit: (data: ProfileFormData) => void;
  seniorityOptions: { value: string; label: string }[];
  jobTypeOptions: string[];
  watchedSeniority?: string[];
  watchedJobTypes?: string[];
  watchedStacks?: string[];
  watchedDiscardTerms?: string[];
  toggleSeniority: (value: 'INTERN' | 'JUNIOR' | 'MID' | 'SENIOR' | 'SPECIALIST' | 'LEAD') => void;
  toggleJobType: (value: string) => void;
  newJobType: string;
  setNewJobType: (v: string) => void;
  addCustomJobType: () => void;
  newStack: string;
  setNewStack: (v: string) => void;
  addStack: () => void;
  removeStack: (s: string) => void;
  newDiscardTerm: string;
  setNewDiscardTerm: (v: string) => void;
  addDiscardTerm: () => void;
  removeDiscardTerm: (t: string) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Cargo desejado</label>
          <Input {...form.register('title')} placeholder="Desenvolvedor Full Stack" />
        </div>
        <div>
          <label className="text-sm font-medium">Localização</label>
          <Input {...form.register('location')} placeholder="São Paulo, Brasil" />
          <p className="text-xs text-muted-foreground mt-1">
            País ou cidade para filtrar vagas. Ex: "Brasil", "Portugal", "EUA"
          </p>
        </div>
        <div>
          <label className="text-sm font-medium">Modalidade</label>
          <Select
            value={form.watch('remotePreference')}
            onValueChange={(value: string) => form.setValue('remotePreference', value as any)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Qualquer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ANY">Qualquer</SelectItem>
              <SelectItem value="REMOTE">Remoto</SelectItem>
              <SelectItem value="HYBRID">Híbrido</SelectItem>
              <SelectItem value="ON_SITE">Presencial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Salário mínimo</label>
          <Input type="number" {...form.register('salaryMin')} />
        </div>
        <div>
          <label className="text-sm font-medium">Salário máximo</label>
          <Input type="number" {...form.register('salaryMax')} />
        </div>
        <div>
          <label className="text-sm font-medium">Moeda</label>
          <Input {...form.register('salaryCurrency')} maxLength={3} />
        </div>
      </div>

      {/* Senioridade - Multi-select */}
      <div>
        <label className="text-sm font-medium mb-2 block">
          Senioridade (selecione uma ou mais)
        </label>
        <div className="flex flex-wrap gap-2">
          {seniorityOptions.map((opt: any) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleSeniority(opt.value)}
              className={cn(
                'px-3 py-1 rounded-full text-sm border transition-colors',
                watchedSeniority?.includes(opt.value)
                  ? 'bg-accent text-accent-foreground border-accent'
                  : 'bg-surface-2 text-foreground border-border hover:border-accent',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tipos de cargo - Multi-select */}
      <div>
        <label className="text-sm font-medium mb-2 block">
          Tipos de cargo (selecione um ou mais)
        </label>
        <div className="flex flex-wrap gap-2">
          {jobTypeOptions.map((type: string) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleJobType(type)}
              className={cn(
                'px-3 py-1 rounded-full text-sm border transition-colors',
                watchedJobTypes?.includes(type)
                  ? 'bg-accent text-accent-foreground border-accent'
                  : 'bg-surface-2 text-foreground border-border hover:border-accent',
              )}
            >
              {type}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <Input
            value={newJobType}
            onChange={(e) => setNewJobType(e.target.value)}
            placeholder="Digite um cargo personalizado e pressione Enter..."
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomJobType())}
          />
          <Button type="button" onClick={addCustomJobType} variant="outline" size="sm">
            +
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {watchedJobTypes?.map((type: string) => (
            <span
              key={type}
              className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent px-3 py-1 text-sm"
            >
              {type}
              <button
                type="button"
                onClick={() => toggleJobType(type)}
                className="hover:text-error"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Stacks de foco */}
      <div>
        <label className="text-sm font-medium mb-2 block">Stacks de foco</label>
        <div className="flex gap-2 mb-2">
          <Input
            value={newStack}
            onChange={(e) => setNewStack(e.target.value)}
            placeholder="Ex: React, Node.js, AWS..."
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addStack())}
          />
          <Button type="button" onClick={addStack} variant="outline">
            +
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {watchedStacks?.map((stack: string) => (
            <span
              key={stack}
              className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success px-3 py-1 text-sm"
            >
              {stack}
              <button type="button" onClick={() => removeStack(stack)} className="hover:text-error">
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Termos de descarte */}
      <div>
        <label className="text-sm font-medium mb-2 block">Termos de descarte</label>
        <div className="flex gap-2 mb-2">
          <Input
            value={newDiscardTerm}
            onChange={(e) => setNewDiscardTerm(e.target.value)}
            placeholder="Ex: Manager, Java, PHP..."
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDiscardTerm())}
          />
          <Button type="button" onClick={addDiscardTerm} variant="outline">
            +
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {watchedDiscardTerms?.map((term: string) => (
            <span
              key={term}
              className="inline-flex items-center gap-1 rounded-full bg-error/10 text-error px-3 py-1 text-sm"
            >
              {term}
              <button
                type="button"
                onClick={() => removeDiscardTerm(term)}
                className="hover:text-error/60"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Resumo profissional</label>
        <textarea
          className={cn(
            'flex min-h-[80px] w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          )}
          {...form.register('summary')}
          placeholder="Breve descrição da sua experiência..."
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando...' : 'Salvar'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <p className="mt-1">{value ?? '-'}</p>
    </div>
  );
}
