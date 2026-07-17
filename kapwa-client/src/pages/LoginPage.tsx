import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Smartphone, HandHeart, ArrowLeft, Eye, EyeOff } from 'lucide-react';

const appendDomain = (v: string) => (v.includes('@') ? v : `${v}@mswdo.test`);
const loginSchema = z.object({
  email: z.string().transform(appendDomain).pipe(z.string().email('Please enter a valid email address.')),
  password: z.string().min(1, 'Please enter your password.'),
});
type LoginValues = z.infer<typeof loginSchema>;

const roleRedirectMap: Record<string, string> = {
  social_worker: '/dashboard',
  admin: '/admin',
  coordinator: '/coordinator',
  claimant: '/my-dashboard',
  mayor: '/reports',
  auditor: '/audit-logs',
};

export function LoginPage() {
  const [error, setError] = useState('');
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
    navigate(roleRedirectMap[user.role] || '/dashboard', { replace: true });
  }

  async function onSubmit(values: LoginValues) {
    setError('');
    try {
      const result = await login(values.email, values.password);
      if (result && 'role' in result) {
        redirectAfterLogin(result);
      }
    } catch {
      setError('Invalid email or password. Please try again.');
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
      setError('Invalid verification code. Please try again.');
    } finally {
      setMfaSubmitting(false);
    }
  }

  // MFA Challenge Mode
  const isSmsOtp = mfaChallenge?.type === 'sms';
  if (mfaChallenge) {
    return (
      <div className="relative flex items-center justify-center min-h-screen px-4 bg-background">
        <Link to="/" className="absolute top-6 left-6 z-10 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors no-underline">
          <ArrowLeft size={16} /> Back to Home
        </Link>
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <Avatar className="w-16 h-16 mx-auto mb-2">
              <AvatarFallback>
                <Smartphone size={32} />
              </AvatarFallback>
            </Avatar>
            <CardTitle>{isSmsOtp ? 'One-Time Password' : 'Two-Factor Authentication'}</CardTitle>
            <CardDescription>{isSmsOtp ? 'Enter the OTP sent to your phone.' : 'Enter the verification code from your authenticator app.'}</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-4" role="alert">
                {error}
              </div>
            )}
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <Input
                type="text"
                inputMode="numeric"
                placeholder="000000"
                maxLength={6}
                className="text-center tracking-[0.25em] text-2xl h-12 tabular-nums"
                value={mfaValue}
                onChange={(e) => setMfaValue(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
              <Button
                type="submit"
                className="w-full"
                disabled={mfaValue.length !== 6 || mfaSubmitting}
              >
                {mfaSubmitting && <Loader2 size={16} className="mr-2 animate-spin" />}
                Verify
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            <Button variant="ghost" onClick={() => { cancelMfa(); setMfaValue(''); setError(''); }}>
              Cancel
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
        <ArrowLeft size={16} /> Back to Home
      </Link>

      <Card className="w-full max-w-md mx-auto relative shadow-lg border-border/50">
        <CardHeader className="text-center pb-6">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-3 shadow-sm">
            <HandHeart size={28} className="text-accent" />
          </div>
          <CardTitle className="text-2xl tracking-tight">Welcome to KAPWA</CardTitle>
          <CardDescription className="text-base">MSWDO Norzagaray Social Welfare System</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
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
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Enter your email" className="h-11" autoFocus {...field} />
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
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showPassword ? 'text' : 'password'} placeholder="Enter your password" className="h-11 pe-10" {...field} />
                        <button
                          type="button"
                          onClick={() => setShowPassword(v => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full h-11"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting && <Loader2 size={16} className="mr-2 animate-spin" />}
                Sign In
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="justify-center pt-2 pb-6">
          <Button variant="link" asChild>
            <Link to="/register">Register as claimant</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
