import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, MailCheck } from 'lucide-react';
import { AuthShell } from '@/components/public/AuthShell';

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const called = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage(t('auth.noVerificationToken', 'No verification token found.'));
      return;
    }
    if (called.current) return;
    called.current = true;

    api.post('/auth/verify-email', { token })
      .then((res: any) => {
        setStatus('success');
        setMessage(res?.message || t('auth.emailVerified', 'Email verified successfully!'));
      })
      .catch((err: any) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : t('auth.verificationFailed', 'Verification failed. The link may be expired.'));
      });
  }, [token]);

  return (
    <AuthShell>
      <Card className="w-full border-border/50 shadow-lg">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-2xl tracking-tight">
            {t('auth.emailVerification', 'Email Verification')}
          </CardTitle>
          <CardDescription className="text-base">
            {t('auth.emailVerificationBody', 'Confirming the address on your KAPWA account.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {status === 'verifying' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 size={40} className="animate-spin text-muted-foreground" aria-hidden="true" />
              <p className="text-muted-foreground">
                {t('auth.verifyingEmail', 'Verifying your email...')}
              </p>
            </div>
          )}
          {status === 'success' && (
            <div className="flex flex-col items-center gap-3 py-4">
              {/* `text-success` is the semantic token. The previous class
                  name was missing the hyphen between the `text` prefix and
                  the colour, so it was not a Tailwind class at all and the
                  success state rendered with no colour. */}
              <CheckCircle size={48} className="text-success" aria-hidden="true" />
              <p className="font-medium text-success">{message}</p>
            </div>
          )}
          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <XCircle size={48} className="text-destructive" aria-hidden="true" />
              <p className="font-medium text-destructive">{message}</p>
              <p className="text-sm text-muted-foreground">
                {t(
                  'auth.requestNewLink',
                  'You can request a new verification email from the sign-in page.'
                )}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-center gap-2 pt-2 pb-6">
          {status === 'success' ? (
            <>
              <Button variant="brand" asChild>
                <Link to="/login">
                  <MailCheck size={16} aria-hidden="true" />
                  {t('auth.goToSignIn', 'Go to Sign In')}
                </Link>
              </Button>
            </>
          ) : (
            <Button variant="outline" asChild>
              <Link to="/login">{t('auth.backToSignIn', 'Back to Sign In')}</Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </AuthShell>
  );
}
