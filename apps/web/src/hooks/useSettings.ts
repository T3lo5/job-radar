import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { setupApi, settingsApi } from '../services/api';
import { toast } from '../components/ui/toast';

export function useSetupStatus() {
  return useQuery({
    queryKey: ['setup', 'status'],
    queryFn: () => setupApi.getStatus(),
  });
}

export function useSettingsScope(scope: string) {
  return useQuery({
    queryKey: ['settings', scope],
    queryFn: () => settingsApi.getScope(scope),
  });
}

export function useSaveSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { scope: string; key: string; value: string; isSecret?: boolean }) =>
      settingsApi.set(data),
    onSuccess: (_, data) => {
      void queryClient.invalidateQueries({ queryKey: ['settings', data.scope] });
      toast.success('Configuração salva');
    },
    onError: () => toast.error('Não foi possível salvar a configuração'),
  });
}

export function useCompleteSetup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => setupApi.complete(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['setup', 'status'] });
      toast.success('Configuração concluída!');
    },
    onError: () => toast.error('Erro ao concluir a configuração'),
  });
}

export function useSaveCron() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { jobCollectionCron: string; dailyReportCron?: string }) =>
      setupApi.saveCron(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['settings', 'cron'] });
      toast.success('Agendamento salvo e reagendado');
    },
    onError: () => toast.error('Erro ao salvar o agendamento'),
  });
}

export function useSaveAI() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      provider: string;
      baseUrl: string;
      apiKey: string;
      model: string;
      customPrompt?: string;
    }) => setupApi.saveAI(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['setup', 'status'] });
      toast.success('Provedor de IA salvo');
    },
    onError: () => toast.error('Erro ao salvar o provedor de IA'),
  });
}

export function useSaveTelegram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { botToken: string; chatId: string }) => setupApi.saveTelegram(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['setup', 'status'] });
      toast.success('Telegram configurado');
    },
    onError: () => toast.error('Erro ao configurar o Telegram'),
  });
}

export function useTestAIConnection() {
  return useMutation({
    mutationFn: (data: { baseUrl: string; apiKey: string; model: string }) =>
      setupApi.testConnection(data),
    onError: () => toast.error('Erro ao testar a conexão'),
  });
}
