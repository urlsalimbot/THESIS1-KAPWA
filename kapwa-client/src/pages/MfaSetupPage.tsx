import { useState, useEffect } from 'react';
import { setupMfa, enableMfa, disableMfa } from '../lib/api';
import { getCurrentUser } from '../lib/auth-context';
import { Shield, Smartphone, CheckCircle } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { FormSkeleton } from '@/components/skeletons/FormSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export function MfaSetupPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'idle' | 'setup' | 'verify' | 'done'>('idle');
  const [secret, setSecret] = useState('');
  const [otpauth, setOtpauth] = useState('');
  const [code, setCode] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [error, setError] = useState('');
  const [disablePw, setDisablePw] = useState('');

  useEffect(() => {
    const ac = new AbortController();
    getCurrentUser(ac.signal).then(u => {
      setUser(u);
      setMfaEnabled(u?.mfaEnabled ?? false);
      setLoading(false);
    });
    return () => ac.abort();
  }, []);

  async function handleSetup() {
    setError('');
    try {
      const res = await setupMfa();
      setSecret(res.secret);
      setOtpauth(res.otpauth);
      setStep('setup');
    } catch (e: any) {
      setError(e.message || 'Setup failed');
    }
  }

  async function handleEnable() {
    setError('');
    try {
      const res = await enableMfa(code);
      setMfaEnabled(res.mfaEnabled);
      setStep('done');
    } catch (e: any) {
      setError(e.message || 'Verification failed');
    }
  }

  async function handleDisable() {
    setError('');
    try {
      const res = await disableMfa(disablePw);
      setMfaEnabled(res.mfaEnabled);
      setStep('idle');
      setSecret('');
      setOtpauth('');
      setDisablePw('');
    } catch (e: any) {
      setError(e.message || 'Disable failed');
    }
  }

  if (loading) {
    return (
      <PageShell title="Multi-Factor Authentication" description="Strengthen account security with TOTP via authenticator app.">
        <Card>
          <CardContent className="p-6">
            <FormSkeleton fields={3} />
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const mfaRoles = ['admin', 'mayor', 'auditor'];
  const canSetup = user && mfaRoles.includes(user.role);

  return (
    <PageShell title="Multi-Factor Authentication" description="Strengthen account security with TOTP via authenticator app.">
      <Card className="max-w-lg">
        <CardContent className="p-6">
          {!canSetup && (
            <p className="text-sm text-muted-foreground">MFA is available for admin, mayor, and auditor roles.</p>
          )}

          {canSetup && step === 'idle' && !mfaEnabled && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Shield className="text-primary" size={32} />
                <div>
                  <p className="font-medium text-foreground">MFA not enabled</p>
                  <p className="text-xs text-muted-foreground">Protect your account with an authenticator app</p>
                </div>
              </div>
              <Button onClick={handleSetup} aria-label="Set Up MFA">
                Set Up MFA
              </Button>
            </div>
          )}

          {step === 'setup' && (
            <div className="space-y-4">
              <div className="rounded bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
                <strong>Step 1:</strong> Open your authenticator app (Google Authenticator, Authy, etc.)
              </div>

              <div>
                <Label className="text-sm font-medium">Manual Entry Key</Label>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 rounded border bg-muted px-3 py-2 text-xs font-mono break-all">{secret}</code>
                  <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(secret)} aria-label="Copy Secret Key">
                    Copy
                  </Button>
                </div>
              </div>

              <div className="text-center">
                <a href={otpauth} className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                  <Smartphone size={16} /> Open Authenticator
                </a>
              </div>

              <div className="rounded bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-700">
                <strong>Step 2:</strong> Enter the 6-digit code from your authenticator app to verify setup.
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex gap-2">
                <Input
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  className="flex-1 text-center text-lg tracking-widest"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                />
                <Button onClick={handleEnable} disabled={code.length !== 6} aria-label="Verify and Enable">
                  Verify & Enable
                </Button>
              </div>
            </div>
          )}

          {step === 'done' && mfaEnabled && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="text-green-600" size={32} />
                <div>
                  <p className="font-medium text-green-800">MFA is enabled</p>
                  <p className="text-xs text-green-600">Your account is now protected with TOTP.</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => { setStep('idle'); setCode(''); }} aria-label="Done">
                Done
              </Button>
            </div>
          )}

          {mfaEnabled && (
            <div className="mt-6 pt-4 border-t">
              <h4 className="text-sm font-medium text-foreground mb-2">Disable MFA</h4>
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Enter password to confirm</Label>
                  <Input type="password" value={disablePw} onChange={e => setDisablePw(e.target.value)} />
                </div>
                <Button variant="destructive" onClick={handleDisable} disabled={!disablePw} aria-label="Disable">
                  Disable
                </Button>
              </div>
              {error && <p className="text-xs text-destructive mt-1">{error}</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
