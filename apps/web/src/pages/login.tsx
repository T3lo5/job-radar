import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from '../components/ui/toast';
import { Loader2, LogIn } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    document.title = 'Entrar — Job Radar';
    // Restaura o título ao sair da tela: sem isto ele vazaria para as páginas
    // seguintes, porque o efeito só roda na montagem.
    return () => {
      document.title = 'Job Radar';
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Preencha email e senha');
      return;
    }

    setIsPending(true);
    try {
      await authApi.login({ email: email.trim(), password });
      toast.success('Bem-vindo de volta!');
      navigate('/', { replace: true });
    } catch {
      toast.error('Email ou senha incorretos');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <LogIn className="h-5 w-5" />
            Entrar no Job Radar
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Use a conta que você criou na primeira configuração.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="login-password" className="text-sm font-medium">
                Senha
              </label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default LoginPage;
