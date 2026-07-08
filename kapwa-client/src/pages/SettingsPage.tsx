import { useState, useEffect } from 'react';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { mutate } from 'swr';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { useAuth } from '@/lib/auth-context';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Shield, Smartphone, CheckCircle, Mail, Lock, Bell, User } from 'lucide-react';

interface NotificationPref {
  id: string;
  userId: string;
  channel: 'sms' | 'in_app';
  category: string;
  optedIn: boolean;
}

const CHANNELS = ['in_app', 'sms'] as const;
const CATEGORIES = ['case_update', 'approval', 'disbursement', 'chat', 'sync_conflict', 'system'] as const;

function ProfileTab() {
  const { user } = useAuth();

  const [newEmail, setNewEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const changeEmail = useSWRMutation(
    'change-email',
    async (_key: string, { arg }: { arg: { newEmail: string; currentPassword: string } }) => {
      return api.post('/auth/change-email', arg);
    },
    {
      onSuccess: () => {
        toast.success('Email updated successfully');
        setNewEmail('');
        setEmailPw('');
        mutate(queryKeys.auth.me());
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to update email');
      },
    },
  );

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');

  const changePassword = useSWRMutation(
    'change-password',
    async (_key: string, { arg }: { arg: { currentPassword: string; newPassword: string } }) => {
      return api.post('/auth/change-password', arg);
    },
    {
      onSuccess: () => {
        toast.success('Password changed successfully');
        setCurrentPw('');
        setNewPw('');
        setConfirmPw('');
        setPwError('');
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to change password');
      },
    },
  );

  function handleChangePassword() {
    setPwError('');
    if (newPw !== confirmPw) {
      setPwError('Passwords do not match');
      return;
    }
    if (newPw.length < 8) {
      setPwError('New password must be at least 8 characters');
      return;
    }
    changePassword.trigger({ currentPassword: currentPw, newPassword: newPw });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User size={18} /> Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-sm text-muted-foreground">Email</Label>
            <p className="text-sm font-medium">{user?.email}</p>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Full Name</Label>
            <p className="text-sm font-medium">{user?.fullName}</p>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Role</Label>
            <p className="text-sm font-medium capitalize">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail size={18} /> Change Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="new-email">New Email</Label>
            <Input id="new-email" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email-pw">Current Password</Label>
            <Input id="email-pw" type="password" value={emailPw} onChange={e => setEmailPw(e.target.value)} />
          </div>
          <Button
            onClick={() => changeEmail.trigger({ newEmail, currentPassword: emailPw })}
            disabled={changeEmail.isMutating || !newEmail || !emailPw}
          >
            {changeEmail.isMutating ? 'Updating...' : 'Update Email'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock size={18} /> Change Password
          </CardTitle>
          <CardDescription>Password must be at least 8 characters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="current-pw">Current Password</Label>
            <Input id="current-pw" type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-pw">New Password</Label>
            <Input id="new-pw" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm-pw">Confirm New Password</Label>
            <Input id="confirm-pw" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
          </div>
          {pwError && <p className="text-xs text-destructive">{pwError}</p>}
          <Button
            onClick={handleChangePassword}
            disabled={changePassword.isMutating || !currentPw || !newPw || !confirmPw}
          >
            {changePassword.isMutating ? 'Changing...' : 'Change Password'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SecurityTab() {
  const { user } = useAuth();
  const { data: userData, isLoading } = useSWR<{ mfaEnabled?: boolean; role?: string }>(queryKeys.auth.me());
  const [step, setStep] = useState<'idle' | 'setup' | 'verify' | 'done'>('idle');
  const [secret, setSecret] = useState('');
  const [otpauth, setOtpauth] = useState('');
  const [code, setCode] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(userData?.mfaEnabled ?? false);
  const [error, setError] = useState('');
  const [disablePw, setDisablePw] = useState('');

  useEffect(() => {
    if (userData) setMfaEnabled(userData.mfaEnabled ?? false);
  }, [userData]);

  async function handleSetup() {
    setError('');
    try {
      const res = await api.post<{ secret: string; otpauth: string }>('/auth/mfa/setup');
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
      const res = await api.post<{ mfaEnabled: boolean }>('/auth/mfa/enable', { code });
      setMfaEnabled(res.mfaEnabled);
      setStep('done');
      mutate(queryKeys.auth.me());
    } catch (e: any) {
      setError(e.message || 'Verification failed');
    }
  }

  async function handleDisable() {
    setError('');
    try {
      await api.post<{ mfaEnabled: boolean }>('/auth/mfa/disable', { password: disablePw });
      setMfaEnabled(false);
      setStep('idle');
      setSecret('');
      setOtpauth('');
      setDisablePw('');
      mutate(queryKeys.auth.me());
    } catch (e: any) {
      setError(e.message || 'Disable failed');
    }
  }

  const mfaRoles = ['admin', 'mayor', 'auditor'];
  const canSetup = user && mfaRoles.includes(user.role);

  if (isLoading) {
    return (
      <Card className="max-w-lg">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
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
            <Button onClick={handleSetup} aria-label="Set Up MFA">Set Up MFA</Button>
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
  );
}

function NotificationsTab() {
  const { user } = useAuth();
  const hasPhone = !!user?.phone;

  const { data: prefs, isLoading } = useSWR<NotificationPref[]>(queryKeys.notifications.preferences());

  const updatePref = useSWRMutation(
    queryKeys.notifications.preferences(),
    async (_key: string, { arg }: { arg: { channel: 'sms' | 'in_app'; category: string; optedIn: boolean } }) => {
      return api.put('/notifications/preferences', arg);
    },
    {
      optimisticData: (current: NotificationPref[] | undefined) => {
        if (!current) return current;
        const { channel, category } = arg;
        return current.map(p =>
          p.channel === channel && p.category === category
            ? { ...p, optedIn: !p.optedIn }
            : p
        );
      },
      revalidate: false,
      populateCache: true,
      rollbackOnError: true,
      onError: () => {
        toast.error('Failed to update notification preference');
      },
    },
  );

  function isOptedIn(channel: string, category: string): boolean {
    if (!prefs) return false;
    const pref = prefs.find(p => p.channel === channel && p.category === category);
    return pref ? pref.optedIn : false;
  }

  const categoryLabels: Record<string, string> = {
    case_update: 'Case Updates',
    approval: 'Approvals',
    disbursement: 'Disbursements',
    chat: 'Chat Messages',
    sync_conflict: 'Sync Conflicts',
    system: 'System Notifications',
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading preferences...</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell size={18} /> Notification Preferences
        </CardTitle>
        <CardDescription>Choose which notifications you receive and how.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Category</th>
                <th className="text-center py-2 px-4 font-medium text-muted-foreground">In-App</th>
                {hasPhone && <th className="text-center py-2 px-4 font-medium text-muted-foreground">SMS</th>}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map(cat => (
                <tr key={cat} className="border-b last:border-b-0">
                  <td className="py-3 pr-4">{categoryLabels[cat] || cat}</td>
                  {CHANNELS.filter(ch => ch !== 'sms' || hasPhone).map(ch => (
                    <td key={ch} className="text-center py-3 px-4">
                      <button
                        onClick={() => updatePref.trigger({ channel: ch, category: cat, optedIn: !isOptedIn(ch, cat) })}
                        disabled={updatePref.isMutating}
                        className={`inline-flex h-6 w-10 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                          isOptedIn(ch, cat) ? 'bg-primary' : 'bg-input'
                        }`}
                        role="switch"
                        aria-checked={isOptedIn(ch, cat)}
                        aria-label={`${categoryLabels[cat] || cat} - ${ch === 'in_app' ? 'In-App' : 'SMS'}`}
                      >
                        <span
                          className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                            isOptedIn(ch, cat) ? 'translate-x-[1.125rem]' : 'translate-x-[0.125rem]'
                          }`}
                        />
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!hasPhone && (
          <p className="text-xs text-muted-foreground mt-4">
            SMS notifications require a phone number on your profile. Contact your administrator.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function SettingsPage() {
  return (
    <PageShell title="Settings" description="Manage your account settings and preferences.">
      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User size={16} /> Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield size={16} /> Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell size={16} /> Notifications
          </TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
