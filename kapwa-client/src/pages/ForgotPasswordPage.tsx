import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Mail } from 'lucide-react';
import { AuthShell } from '@/components/public/AuthShell';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      setError(t('auth.somethingWentWrong', 'Something went wrong. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthShell>
        <Card className="w-full border-border/50 shadow-lg">
          <CardHeader className="text-center pb-6">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-inset ring-accent/15">
              <Mail size={28} className="text-accent" aria-hidden="true" />
            </div>
            <CardTitle className="text-2xl tracking-tight">
              {t('auth.checkYourEmail', 'Check Your Email')}
            </CardTitle>
            <CardDescription className="text-base">
              {t(
                'auth.checkEmailBody',
                "If an account with that email exists, we've sent a password reset link."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-sm text-muted-foreground">
              {t(
                'auth.checkSpamFolder',
                "Didn't receive it? Check your spam folder, or try again in a few minutes."
              )}
            </p>
          </CardContent>
          <CardFooter className="justify-center pt-2 pb-6">
            <Button variant="link" asChild>
              <Link to="/login">{t('auth.backToSignIn', 'Back to Sign In')}</Link>
            </Button>
          </CardFooter>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className="w-full border-border/50 shadow-lg">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-inset ring-accent/15">
            <Mail size={28} className="text-accent" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl tracking-tight">
            {t('auth.forgotPassword', 'Forgot Password')}
          </CardTitle>
          <CardDescription className="text-base">
            {t('auth.forgotPasswordBody', "Enter your email and we'll send you a reset link.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              autoComplete="email"
              placeholder={t('auth.emailPlaceholder', 'Enter your email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="h-11"
              aria-label={t('auth.emailLabel', 'Email')}
            />
            <Button
              type="submit"
              variant="brand"
              className="h-11 w-full"
              disabled={submitting || !email}
            >
              {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {t('auth.sendResetLink', 'Send Reset Link')}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center pt-2 pb-6">
          <Button variant="link" asChild>
            <Link to="/login">{t('auth.backToSignIn', 'Back to Sign In')}</Link>
          </Button>
        </CardFooter>
      </Card>
    </AuthShell>
  );
}
