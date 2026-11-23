import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from '../components/ui/toast';
import { Loader2, UserPlus } from 'lucide-react';

export function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    document.title = 'Criar conta — Job Radar';
    return () => {
      document.title = 'Job Radar';
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || !confirmPassword) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setIsPending(true);
    try {
      await authApi.signup({
        email: email.trim(),
        password,
        confirmPassword,
      });
      toast.success('Conta criada com sucesso!');
      navigate('/login', { replace: true });
    } catch (err) {
      const codigo = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      if (codigo === 'SIGNUP_DISABLED') {
        toast.error('O cadastro público está desativado nesta instalação.');
      } else {
        toast.error('Não foi possível criar a conta');
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <UserPlus className="h-5 w-5" />
            Criar conta
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Preencha os dados para criar sua conta no Job Radar.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="signup-email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="signup-email"
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
              <label htmlFor="signup-password" className="text-sm font-medium">
                Senha
              </label>
              <Input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="signup-confirm-password" className="text-sm font-medium">
                Confirme a senha
              </label>
              <Input
                id="signup-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar conta'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default SignupPage;
