import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authApi } from '../services/api';

type State = 'loading' | 'setup' | 'login' | 'ready';

/**
 * Porteira de autenticação.
 *
 * Só renderiza as rotas protegidas quando existe uma sessão válida. Sem isso a
 * porteira ficava apenas no interceptor do axios, que redireciona *depois* de
 * uma request falhar — o usuário via um flash da tela quebrada antes do
 * redirect.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const status = await authApi.status();

        // Nenhuma conta criada ainda: manda para o wizard de primeiro boot.
        if (!status.accountExists) {
          if (!cancelled) setState('setup');
          return;
        }

        await authApi.me();
        if (!cancelled) setState('ready');
      } catch (err) {
        // 401/423 vindos do `me()` significam "existe conta, mas sem sessão".
        const httpStatus = (err as { response?: { status?: number } })?.response?.status;
        if (httpStatus === 401 || httpStatus === 423) {
          if (!cancelled) setState('login');
        } else {
          // Falha de rede ou servidor: não chuta o usuário para o login sem
          // necessidade, deixa a tela aparecer e cada query trata seu erro.
          if (!cancelled) setState('ready');
        }
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (state === 'setup') return <Navigate to="/setup" replace />;
  if (state === 'login') return <Navigate to="/login" replace />;

  return <>{children}</>;
}

export default AuthGate;
