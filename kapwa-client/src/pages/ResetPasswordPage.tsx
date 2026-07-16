import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle, XCircle, ArrowLeft, Lock, Eye, EyeOff } from 'lucide-react';

export function ResetPasswordPage() {
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
      setMessage('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setMessage('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      const res: any = await api.post('/auth/reset-password', { token, password });
      setStatus('success');
      setMessage(res?.message || 'Password reset successfully!');
    } catch (err: any) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Reset failed. The link may be expired.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen px-4 overflow-hidden bg-background">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent/5 rounded-full blur-3xl" />
      </div>
      <Link to="/" className="absolute top-6 left-6 z-10 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors no-underline">
        <ArrowLeft size={16} /> Back to Home
      </Link>
      <Card className="w-full max-w-md mx-auto relative shadow-lg border-border/50">
        <CardHeader className="text-center pb-6">
          {status === 'success' ? (
            <CheckCircle size={48} className="text-green-500 mx-auto mb-2" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-3 shadow-sm">
              <Lock size={28} className="text-accent" />
            </div>
          )}
          <CardTitle className="text-2xl tracking-tight">
            {status === 'success' ? 'Password Reset' : 'Set New Password'}
          </CardTitle>
          <CardDescription className="text-base">
            {status === 'success' ? message : 'Enter your new password below.'}
          </CardDescription>
        </CardHeader>
        {status === 'idle' && (
          <CardContent>
            {message && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-4" role="alert">
                {message}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="New password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoFocus
                  className="h-11 pe-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <Input
                type="password"
                placeholder="Confirm new password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                minLength={8}
                className="h-11"
              />
              <Button type="submit" className="w-full h-11" disabled={submitting || !password || !confirm}>
                {submitting && <Loader2 size={16} className="mr-2 animate-spin" />}
                Reset Password
              </Button>
            </form>
          </CardContent>
        )}
        {status === 'error' && (
          <CardContent className="text-center">
            <XCircle size={48} className="text-destructive mx-auto mb-3" />
            <p className="text-destructive font-medium">{message}</p>
          </CardContent>
        )}
        <CardFooter className="justify-center pt-2 pb-6">
          <Button variant="link" asChild>
            <Link to="/login">Back to Sign In</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
