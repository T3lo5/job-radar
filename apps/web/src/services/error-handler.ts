import { toast } from '../components/ui/toast';

type RetryFn = () => void;

export function createErrorToast(title: string, retry?: RetryFn, description?: string) {
  return toast.error({
    title,
    description,
    action: retry
      ? {
          label: 'Tentar novamente',
          onClick: retry,
          variant: 'outline',
        }
      : undefined,
  });
}

export function createNetworkErrorToast(retry?: RetryFn) {
  return createErrorToast(
    'Erro de conexão',
    retry,
    'Não foi possível conectar ao servidor. Verifique se o Job Radar está rodando (./dev-up.sh).',
  );
}

export function createApiErrorToast(
  error: unknown,
  retry?: RetryFn,
  defaultMessage = 'Ocorreu um erro inesperado',
) {
  const message = error instanceof Error ? error.message : defaultMessage;
  const isNetworkError = error instanceof TypeError && error.message.includes('Network Error');

  if (isNetworkError) {
    return createNetworkErrorToast(retry);
  }

  return createErrorToast('Erro', retry, message);
}

export function handleApiError(error: unknown, context: string, retry?: RetryFn) {
  console.error(`[${context}]`, error);
  return createApiErrorToast(error, retry);
}
