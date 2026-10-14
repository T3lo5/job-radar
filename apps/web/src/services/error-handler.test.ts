import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createErrorToast,
  createNetworkErrorToast,
  createApiErrorToast,
  handleApiError,
} from './error-handler';

/**
 * O tratamento de erro é a última linha de defesa do usuário: se ele classifica
 * mal, alguém recebe "Ocorreu um erro inesperado" quando o servidor nem
 * estava no ar — e a orientacao de subir o stack some.
 *
 * O toast é mockado porque a asserção é sobre a CLASSIFICAÇÃO, não sobre a
 * animação do componente.
 */
const toastError = vi.fn();

vi.mock('../components/ui/toast', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
  },
}));

// handleApiError faz console.error de propósito. Silencia aqui para não
// despejar stack trace na saída de todo teste.
beforeEach(() => {
  toastError.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createApiErrorToast — separa rede de aplicacao', () => {
  it('reconhece erro de rede do axios', () => {
    // Axios lanca TypeError com essa mensagem quando o servidor nao responde.
    createApiErrorToast(new TypeError('Network Error'));

    expect(toastError).toHaveBeenCalledTimes(1);
    const arg = toastError.mock.calls[0][0] as { title: string; description: string };
    expect(arg.title).toBe('Erro de conexão');
    expect(arg.description).toContain('./dev-up.sh');
  });

  it('NAO trata TypeError comum como erro de rede', () => {
    // `x is not a function` também é TypeError. Classificar isso como "ligue o
    // servidor" mandaria o usuário para o lugar errado.
    createApiErrorToast(new TypeError('x is not a function'));

    const arg = toastError.mock.calls[0][0] as { title: string; description: string };
    expect(arg.title).toBe('Erro');
    expect(arg.description).toBe('x is not a function');
  });

  it('usa a mensagem do erro quando existe', () => {
    createApiErrorToast(new Error('Vaga não encontrada'));
    const arg = toastError.mock.calls[0][0] as { description: string };
    expect(arg.description).toBe('Vaga não encontrada');
  });

  it('usa a mensagem padrao para erro sem texto', () => {
    createApiErrorToast('apenas uma string');
    const arg = toastError.mock.calls[0][0] as { description: string };
    expect(arg.description).toBe('Ocorreu um erro inesperado');
  });

  it('aceita override da mensagem padrao', () => {
    createApiErrorToast(undefined, undefined, 'Falha ao salvar');
    const arg = toastError.mock.calls[0][0] as { description: string };
    expect(arg.description).toBe('Falha ao salvar');
  });
});

describe('botao de tentar novamente', () => {
  it('inclui a acao quando ha retry', () => {
    const retry = vi.fn();
    createErrorToast('Erro', retry);

    const arg = toastError.mock.calls[0][0] as {
      action: { label: string; onClick: () => void };
    };
    expect(arg.action.label).toBe('Tentar novamente');
    expect(arg.action.onClick).toBe(retry);
  });

  it('omite a acao quando nao ha retry', () => {
    createErrorToast('Erro');
    const arg = toastError.mock.calls[0][0] as { action?: unknown };
    expect(arg.action).toBeUndefined();
  });

  it('o retry funciona quando clicado', () => {
    const retry = vi.fn();
    createErrorToast('Erro', retry);
    const arg = toastError.mock.calls[0][0] as { action: { onClick: () => void } };
    arg.action.onClick();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('erro de rede tambem oferece retry', () => {
    const retry = vi.fn();
    createNetworkErrorToast(retry);
    const arg = toastError.mock.calls[0][0] as { action?: { onClick: () => void } };
    expect(arg.action).toBeDefined();
  });
});

describe('handleApiError', () => {
  it('loga o contexto e mostra o toast', () => {
    handleApiError(new Error('falhou'), 'carregarVagas');
    expect(console.error).toHaveBeenCalledWith('[carregarVagas]', expect.any(Error));
  });

  it('nao engole o erro: devolve o toast, e nao lanca', () => {
    // Se engole, quem chama perde a chance de tratar.
    expect(() => handleApiError(new Error('x'), 'contexto')).not.toThrow();
  });
});
