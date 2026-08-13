import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth-context';
import { api } from '../lib/api';
import { ROLE_REDIRECT_MAP } from '@/lib/role-access';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { TFunction } from 'i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Smartphone, HandHeart, ArrowLeft, Eye, EyeOff } from 'lucide-react';

const appendDomain = (v: string) => (v.includes('@') ? v : `${v}@mswdo.test`);
type LoginValues = z.infer<ReturnType<typeof makeLoginSchema>>;

const makeLoginSchema = (t: TFunction) => z.object({
  email: z.string().transform(appendDomain).pipe(z.string().email(t('auth.emailInvalid', 'Please enter a valid email address.'))),
  password: z.string().min(1, t('auth.passwordRequired', 'Please enter your password.')),
});

export function LoginPage() {
  const { t } = useTranslation();
  const loginSchema = useMemo(() => makeLoginSchema(t), [t]);
  const [error, setError] = useState('');
  const [emailNotVerified, setEmailNotVerified] = useState('');
  const [mfaValue, setMfaValue] = useState('');
  const [mfaSubmitting, setMfaSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, resolveMfa, cancelMfa, mfaChallenge } = useAuth();
  const navigate = useNavigate();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onChange',
  });

  function redirectAfterLogin(user: { role: string }) {
    navigate(ROLE_REDIRECT_MAP[user.role] || '/dashboard', { replace: true });
  }

  async function onSubmit(values: LoginValues) {
    setError('');
    setEmailNotVerified('');
    try {
      const result = await login(values.email, values.password);
      if (result && 'role' in result) {
        redirectAfterLogin(result);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('verify your email')) {
        setEmailNotVerified(values.email);
      } else {
        setError(t('auth.invalidCredentials', 'Invalid email or password. Please try again.'));
      }
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (mfaValue.length !== 6) return;
    setMfaSubmitting(true);
    try {
      const user = await resolveMfa(mfaValue);
      if (user) redirectAfterLogin(user);
      else navigate('/dashboard', { replace: true });
    } catch {
      setError(t('auth.invalidVerificationCode', 'Invalid verification code. Please try again.'));
    } finally {
      setMfaSubmitting(false);
    }
  }

  // MFA Challenge Mode
  const isSmsOtp = mfaChallenge?.type === 'sms';
  if (mfaChallenge) {
    return (
      <div className="relative flex items-center justify-center min-h-screen px-4 overflow-hidden bg-background">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-accent/3 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] bg-muted/20 rounded-full blur-3xl opacity-40" />
        </div>
        <Link to="/" className="absolute top-6 left-6 z-10 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors no-underline">
          <ArrowLeft size={16} /> {t('auth.backToHome', 'Back to Home')}
        </Link>
        <Card className="w-full max-w-md mx-auto relative shadow-lg border-border/50">
          <CardHeader className="text-center pb-6">
            <Avatar className="w-14 h-14 mx-auto mb-3 shadow-sm">
              <AvatarFallback className="bg-accent/10">
                <Smartphone size={28} className="text-accent" />
              </AvatarFallback>
            </Avatar>
            <CardTitle className="text-2xl tracking-tight">{isSmsOtp ? t('auth.oneTimePassword', 'One-Time Password') : t('auth.twoFactor', 'Two-Factor Authentication')}</CardTitle>
            <CardDescription className="text-base">{isSmsOtp ? t('auth.otpSentToPhone', 'Enter the OTP sent to your phone.') : t('auth.enterVerificationCode', 'Enter the verification code from your authenticator app.')}</CardDescription>
          </CardHeader>
          <CardContent className="pb-2">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-6" role="alert">
                {error}
              </div>
            )}
            <form onSubmit={handleMfaSubmit} className="space-y-6">
              <div className="flex gap-2 justify-center">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <input
                    key={i}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={mfaValue[i] || ''}
                    onChange={(e) => {
                      const dig = e.target.value.replace(/\D/g, '').slice(-1);
                      if (!dig) return;
                      const next = mfaValue.slice(0, i) + dig + mfaValue.slice(i + 1);
                      setMfaValue(next.slice(0, 6));
                      const inputs = (e.target as HTMLInputElement).closest('div')?.parentElement?.querySelectorAll('input');
                      inputs?.[i + 1]?.focus();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace') {
                        e.preventDefault();
                        const arr = mfaValue.split('');
                        if (arr[i]) {
                          arr[i] = '';
                          setMfaValue(arr.join(''));
                        } else if (i > 0) {
                          arr[i - 1] = '';
                          setMfaValue(arr.join(''));
                          const inputs = (e.target as HTMLInputElement).closest('div')?.parentElement?.querySelectorAll('input');
                          inputs?.[i - 1]?.focus();
                        }
                      }
                      if (e.key === 'ArrowLeft') {
                        const inputs = (e.target as HTMLInputElement).closest('div')?.parentElement?.querySelectorAll('input');
                        inputs?.[i - 1]?.focus();
                      }
                      if (e.key === 'ArrowRight') {
                        const inputs = (e.target as HTMLInputElement).closest('div')?.parentElement?.querySelectorAll('input');
                        inputs?.[i + 1]?.focus();
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    autoFocus={i === 0}
                    className="w-11 h-14 text-center text-xl font-semibold tracking-widest rounded-lg border border-input bg-background shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 tabular-nums transition-all duration-150"
                    aria-label={t('auth.digitLabel', 'Digit {{n}}', { n: i + 1 })}
                  />
                ))}
              </div>
              <Button
                type="submit"
                className="w-full h-11"
                disabled={mfaValue.length !== 6 || mfaSubmitting}
              >
                {mfaSubmitting && <Loader2 size={16} className="mr-2 animate-spin" />}
                {t('auth.verify', 'Verify')}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center pt-2 pb-6">
            <Button variant="ghost" onClick={() => { cancelMfa(); setMfaValue(''); setError(''); }}>
              {t('auth.cancel', 'Cancel')}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Login Form Mode
  return (
    <div className="relative flex items-center justify-center min-h-screen px-4 overflow-hidden bg-background">
      {/* Background decoration with visual depth */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-accent/3 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] bg-muted/20 rounded-full blur-3xl opacity-40" />
      </div>

      <Link to="/" className="absolute top-6 left-6 z-10 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors no-underline">
        <ArrowLeft size={16} /> {t('auth.backToHome', 'Back to Home')}
      </Link>

      <Card className="w-full max-w-md mx-auto relative shadow-lg border-border/50">
        <CardHeader className="text-center pb-6">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-3 shadow-sm">
            <HandHeart size={28} className="text-accent" />
          </div>
          <CardTitle className="text-2xl tracking-tight">{t('auth.welcomeToKapwa', 'Welcome to KAPWA')}</CardTitle>
          <CardDescription className="text-base">{t('auth.mswdoTagline', 'MSWDO Norzagaray Social Welfare System')}</CardDescription>
        </CardHeader>
        <CardContent>
          {emailNotVerified && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3 rounded-md mb-4">
              <p className="font-medium mb-1">{t('auth.emailNotVerified', 'Email not verified')}</p>
              <p className="mb-2">{t('auth.checkInboxForVerification', 'Please check your inbox for the verification link.')}</p>
              <button
                type="button"
                className="text-amber-900 underline underline-offset-2 hover:no-underline text-xs"
                onClick={async () => {
                  try {
                    await api.post('/auth/resend-verification', { email: emailNotVerified });
                    setEmailNotVerified('');
                    setError(t('auth.verificationResent', 'Verification email resent! Check your inbox.'));
                  } catch {
                    setError(t('auth.resendFailed', 'Failed to resend. Try again later.'));
                  }
                }}
              >
                {t('auth.resendVerificationEmail', 'Resend verification email')}
              </button>
            </div>
          )}
          {error && !emailNotVerified && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-4" role="alert">
              {error}
            </div>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.emailLabel', 'Email')}</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder={t('auth.emailPlaceholder', 'Enter your email')} className="h-11" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.passwordLabel', 'Password')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showPassword ? 'text' : 'password'} placeholder={t('auth.passwordPlaceholder', 'Enter your password')} className="h-11 pe-10" {...field} />
                        <button
                          type="button"
                          onClick={() => setShowPassword(v => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={showPassword ? t('auth.hidePassword', 'Hide password') : t('auth.showPassword', 'Show password')}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end -mt-2">
                <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline transition-colors">
                  {t('auth.forgotPasswordQuestion', 'Forgot password?')}
                </Link>
              </div>
              <Button
                type="submit"
                className="w-full h-11"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting && <Loader2 size={16} className="mr-2 animate-spin" />}
                {t('auth.signIn', 'Sign In')}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="justify-center pt-2 pb-6">
          <Button variant="link" asChild>
            <Link to="/register">{t('auth.registerAsClaimant', 'Register as claimant')}</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
