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
import { Loader2, Smartphone, HandHeart } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Please enter your password.'),
});
type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [error, setError] = useState('');
  const [mfaValue, setMfaValue] = useState('');
  const [mfaSubmitting, setMfaSubmitting] = useState(false);
  const { login, resolveMfa, cancelMfa, mfaChallenge } = useAuth();
  const navigate = useNavigate();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginValues) {
    setError('');
    try {
      const result = await login(values.email, values.password);
      if (!result?.mfaRequired) {
        navigate('/dashboard', { replace: true });
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
      await resolveMfa(mfaValue);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Invalid verification code. Please try again.');
    } finally {
      setMfaSubmitting(false);
    }
  }

  // MFA Challenge Mode
  if (mfaChallenge) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] px-4">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <Avatar className="w-16 h-16 mx-auto mb-2">
              <AvatarFallback>
                <Smartphone className="w-8 h-8" />
              </AvatarFallback>
            </Avatar>
            <CardTitle>Two-Factor Authentication</CardTitle>
            <CardDescription>Enter the verification code from your authenticator app.</CardDescription>
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
                className="text-center tracking-[0.25em] text-2xl h-12"
                value={mfaValue}
                onChange={(e) => setMfaValue(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
              <Button
                type="submit"
                className="w-full"
                disabled={mfaValue.length !== 6 || mfaSubmitting}
              >
                {mfaSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
    <div className="relative flex items-center justify-center min-h-[calc(100vh-8rem)] px-4 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-accent/3 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md mx-auto relative">
        <CardHeader className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
            <HandHeart className="w-7 h-7 text-accent" />
          </div>
          <CardTitle className="text-xl">Welcome to KAPWA</CardTitle>
          <CardDescription>MSWDO Norzagaray Social Welfare System</CardDescription>
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
                      <Input type="password" placeholder="Enter your password" className="h-11" {...field} />
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
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="justify-center">
          <Button variant="link" asChild>
            <Link to="/register">Register as claimant</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
