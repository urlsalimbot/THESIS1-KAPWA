import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle, XCircle, Lock, Eye, EyeOff } from 'lucide-react';
import { AuthShell } from '@/components/public/AuthShell';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>(token ? 'idle' : 'error');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setMessage(t('auth.passwordsDontMatch', 'Passwords do not match.'));
      return;
    }
    if (password.length < 8) {
      setMessage(t('auth.passwordMinLength', 'Password must be at least 8 characters.'));
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      const res: any = await api.post('/auth/reset-password', { token, password });
      setStatus('success');
      setMessage(res?.message || t('auth.passwordResetSuccess', 'Password reset successfully!'));
    } catch (err: any) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : t('auth.resetFailed', 'Reset failed. The link may be expired.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <Card className="w-full border-border/50 shadow-lg">
        <CardHeader className="text-center pb-6">
          {status === 'success' ? (
            // `text-success` replaces an invalid class name that was missing
            // the hyphen between the `text` prefix and the colour, which
            // produced an unstyled icon.
            <CheckCircle size={48} className="mx-auto mb-2 text-success" aria-hidden="true" />
          ) : (
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-inset ring-accent/15">
              <Lock size={28} className="text-accent" aria-hidden="true" />
            </div>
          )}
          <CardTitle className="text-2xl tracking-tight">
            {status === 'success'
              ? t('auth.passwordReset', 'Password Reset')
              : t('auth.setNewPassword', 'Set New Password')}
          </CardTitle>
          <CardDescription className="text-base">
            {status === 'success'
              ? message
              : t('auth.enterNewPassword', 'Enter your new password below.')}
          </CardDescription>
        </CardHeader>
        {status === 'idle' && (
          <CardContent>
            {message && (
              <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                {message}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder={t('auth.newPasswordPlaceholder', 'New password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoFocus
                  className="h-11 pe-10"
                  aria-label={t('auth.newPasswordPlaceholder', 'New password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={
                    showPassword
                      ? t('auth.hidePassword', 'Hide password')
                      : t('auth.showPassword', 'Show password')
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
                </button>
              </div>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder={t('auth.confirmPasswordPlaceholder', 'Confirm new password')}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                className="h-11"
                aria-label={t('auth.confirmPasswordPlaceholder', 'Confirm new password')}
              />
              <Button
                type="submit"
                variant="brand"
                className="h-11 w-full"
                disabled={submitting || !password || !confirm}
              >
                {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {t('auth.resetPassword', 'Reset Password')}
              </Button>
            </form>
          </CardContent>
        )}
        {status === 'error' && (
          <CardContent className="text-center">
            <XCircle size={48} className="mx-auto mb-3 text-destructive" aria-hidden="true" />
            <p className="font-medium text-destructive">{message}</p>
          </CardContent>
        )}
        <CardFooter className="justify-center pt-2 pb-6">
          {status === 'success' ? (
            <Button variant="brand" asChild>
              <Link to="/login">{t('auth.goToSignIn', 'Go to Sign In')}</Link>
            </Button>
          ) : (
            <Button variant="link" asChild>
              <Link to="/login">{t('auth.backToSignIn', 'Back to Sign In')}</Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </AuthShell>
  );
}
