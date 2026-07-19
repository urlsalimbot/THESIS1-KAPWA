import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const called = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found.');
      return;
    }
    if (called.current) return;
    called.current = true;

    api.post('/auth/verify-email', { token })
      .then((res: any) => {
        setStatus('success');
        setMessage(res?.message || 'Email verified successfully!');
      })
      .catch((err: any) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Verification failed. The link may be expired.');
      });
  }, [token]);

  return (
    <div className="relative flex items-center justify-center min-h-screen px-4 bg-background">
      <Card className="w-full max-w-md mx-auto shadow-lg border-border/50">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-2xl tracking-tight">Email Verification</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === 'verifying' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 size={40} className="animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Verifying your email...</p>
            </div>
          )}
          {status === 'success' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle size={48} className="text-green-500" />
              <p className="text-green-700 font-medium">{message}</p>
            </div>
          )}
          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <XCircle size={48} className="text-destructive" />
              <p className="text-destructive font-medium">{message}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-center pt-2 pb-6 gap-2">
          {status === 'success' && (
            <Button asChild>
              <Link to="/login">Go to Sign In</Link>
            </Button>
          )}
          {status === 'error' && (
            <Button variant="link" asChild>
              <Link to="/login">Back to Sign In</Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
