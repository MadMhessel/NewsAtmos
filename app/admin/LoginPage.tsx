import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock } from 'lucide-react';

const ADMIN_PASSWORD_SHA256 = "da03c698dbef2649ddf0af56552483c31de6954d03d065da949b6a5c6d285b6b";

async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function LoginPage({ redirectTo = '/admin', onSuccess }: { redirectTo?: string; onSuccess?: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsBusy(true);

    try {
      const hash = await sha256(password);
      if (hash === ADMIN_PASSWORD_SHA256) {
        sessionStorage.setItem('admin_auth', 'true');
        sessionStorage.setItem('admin_token', password);
        onSuccess?.();
        navigate(redirectTo, { replace: true });
        return;
      }
      setError('Неверный пароль');
    } catch {
      setError('Не удалось проверить пароль. Попробуйте снова.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-sm p-6 sm:p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold">Вход в админ‑панель</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            Доступ только по паролю
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
              autoComplete="current-password"
            />
            {error && <p className="text-xs text-destructive font-medium">{error}</p>}
          </div>

          <Button type="submit" className="w-full h-11" disabled={isBusy}>
            {isBusy ? 'Проверяем…' : 'Войти'}
          </Button>
        </form>

        <p className="text-[11px] text-muted-foreground mt-6 leading-relaxed">
          Важно: если вы делитесь компьютером, после работы нажмите «Выйти».
        </p>
      </div>
    </div>
  );
}
