# Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified `/settings` page with Profile, Security (MFA), and Notifications tabs.

**Architecture:** Server-side NestJS controllers/services for change-password, change-email, and bulk notification preferences. Client-side single React page with three tab sections reusing existing MFA flow and SWR patterns.

**Tech Stack:** NestJS + TypeORM + Zod (server), React + SWR + shadcn/ui Tabs + sonner toast (client)

## Global Constraints

- Server uses Zod for DTO validation, bcrypt for password hashing (12 salt rounds)
- Client uses `api` from `src/lib/api.ts` for authenticated requests, `useSWR` for data fetching, `useSWRMutation` + `mutate` for mutations
- Client uses shadcn/ui components (Tabs, Card, Input, Button, Label, Switch, Separator, toast via sonner)
- All server endpoints require JWT auth via `@UseGuards(JwtAuthGuard)`
- Password minimum length: 8 characters (defined in server `src/auth/constants.ts`)
- All API responses use snake_case; client query keys use camelCase via `queryKeys` memo factory

---

### Task 1: Add change-password and change-email DTOs

**Files:**
- Modify: `kapwa-server/src/auth/dto/auth.zod.ts`

**Interfaces:**
- Consumes: `MIN_PASSWORD_LENGTH` from `../constants`
- Produces: `ChangePasswordSchema`, `ChangeEmailSchema`, `ChangePasswordInput`, `ChangeEmailInput`

- [ ] **Step 1: Add schemas**

```typescript
// kapwa-server/src/auth/dto/auth.zod.ts — after MfaVerifySchema

export const ChangePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
});

export const ChangeEmailSchema = z.object({
  newEmail: z.string().email(),
  currentPassword: z.string(),
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type ChangeEmailInput = z.infer<typeof ChangeEmailSchema>;
```

- [ ] **Step 2: Verify project compiles**

Run: `npx tsc --noEmit` in `kapwa-server/`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add kapwa-server/src/auth/dto/auth.zod.ts
git commit -m "feat(server): add change-password and change-email DTOs"
```

---

### Task 2: Implement change-password and change-email in auth service

**Files:**
- Modify: `kapwa-server/src/auth/auth.service.ts`
- Test: No test file yet — manual verification

**Interfaces:**
- Consumes: `ChangePasswordInput`, `ChangeEmailInput` from Task 1; `findByIdWithSecret()` already exists; `bcrypt`, `BadRequestException`, `ConflictException`
- Produces: `changePassword(userId, body)` returning `{ message }`, `changeEmail(userId, body)` returning `{ user }`

- [ ] **Step 1: Add changePassword method**

```typescript
// kapwa-server/src/auth/auth.service.ts — after disableMfa

async changePassword(userId: string, body: { currentPassword: string; newPassword: string }) {
  const user = await this.findByIdWithSecret(userId);
  if (!user) throw new UnauthorizedException();

  const valid = await bcrypt.compare(body.currentPassword, user.password);
  if (!valid) throw new BadRequestException('Current password is incorrect');

  const hashed = await bcrypt.hash(body.newPassword, BCRYPT_SALT_ROUNDS);
  user.password = hashed;
  await this.userRepo.save(user);

  return { message: 'Password changed successfully' };
}
```

- [ ] **Step 2: Add changeEmail method**

```typescript
// kapwa-server/src/auth/auth.service.ts — after changePassword

async changeEmail(userId: string, body: { newEmail: string; currentPassword: string }) {
  const user = await this.findByIdWithSecret(userId);
  if (!user) throw new UnauthorizedException();

  const valid = await bcrypt.compare(body.currentPassword, user.password);
  if (!valid) throw new BadRequestException('Current password is incorrect');

  const existing = await this.userRepo.findOne({ where: { email: body.newEmail } });
  if (existing) throw new ConflictException('Email already in use');

  user.email = body.newEmail;
  await this.userRepo.save(user);

  return { user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName } };
}
```

- [ ] **Step 3: Verify project compiles**

Run: `npx tsc --noEmit` in `kapwa-server/`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add kapwa-server/src/auth/auth.service.ts
git commit -m "feat(server): add changePassword and changeEmail service methods"
```

---

### Task 3: Add change-password and change-email endpoints

**Files:**
- Modify: `kapwa-server/src/auth/auth.controller.ts`

**Interfaces:**
- Consumes: `ChangePasswordSchema`, `ChangeEmailSchema` from Task 1; `changePassword()`, `changeEmail()` from Task 2
- Produces: `POST /auth/change-password`, `POST /auth/change-email`

- [ ] **Step 1: Import DTOs and add endpoints**

Update the import line to include the new schemas:

```typescript
// kapwa-server/src/auth/auth.controller.ts — line 5
import { ..., ChangePasswordSchema, ChangeEmailSchema, ChangePasswordInput, ChangeEmailInput } from './dto/auth.zod';
```

Add after `verifyLoginOtp`:

```typescript
@Post('change-password')
@UseGuards(JwtAuthGuard)
async changePassword(
  @Request() req: AuthenticatedRequest,
  @Body(new ZodPipe(ChangePasswordSchema)) body: ChangePasswordInput
) {
  return this.authService.changePassword(req.user.id, body);
}

@Post('change-email')
@UseGuards(JwtAuthGuard)
async changeEmail(
  @Request() req: AuthenticatedRequest,
  @Body(new ZodPipe(ChangeEmailSchema)) body: ChangeEmailInput
) {
  return this.authService.changeEmail(req.user.id, body);
}
```

- [ ] **Step 2: Verify project compiles**

Run: `npx tsc --noEmit` in `kapwa-server/`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add kapwa-server/src/auth/auth.controller.ts
git commit -m "feat(server): add change-password and change-email endpoints"
```

---

### Task 4: Add bulk notification preferences endpoint

**Files:**
- Modify: `kapwa-server/src/notifications/notifications.controller.ts`
- Modify: `kapwa-server/src/notifications/notifications.service.ts`

**Interfaces:**
- Consumes: `BulkUpdatePreferencesSchema` from `./dto/notifications.zod` (already exists), `setPreference()` already exists
- Produces: `PUT /notifications/preferences/bulk` — accepts array, upserts each

- [ ] **Step 1: Add bulkSetPreferences method to service**

```typescript
// kapwa-server/src/notifications/notifications.service.ts — after setPreference

async bulkSetPreferences(userId: string, prefs: UpdatePreferenceInput[]) {
  const results = [];
  for (const pref of prefs) {
    const result = await this.setPreference(userId, pref);
    results.push(result);
  }
  return results;
}
```

- [ ] **Step 2: Add bulk endpoint to controller**

Add import for `BulkUpdatePreferencesSchema`:

```typescript
// kapwa-server/src/notifications/notifications.controller.ts — line 7
import { ..., BulkUpdatePreferencesSchema, BulkUpdatePreferencesInput } from './dto/notifications.zod';
```

Add after `setPreference`:

```typescript
@Put('preferences/bulk')
@Roles('admin', 'social_worker', 'coordinator', 'claimant', 'auditor')
async bulkSetPreferences(
  @Request() req: AuthenticatedRequest,
  @Body(new ZodPipe(BulkUpdatePreferencesSchema)) body: BulkUpdatePreferencesInput
) {
  return this.notifService.bulkSetPreferences(req.user.id, body);
}
```

- [ ] **Step 3: Verify project compiles**

Run: `npx tsc --noEmit` in `kapwa-server/`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add kapwa-server/src/notifications/notifications.controller.ts kapwa-server/src/notifications/notifications.service.ts
git commit -m "feat(server): add bulk notification preferences endpoint"
```

---

### Task 5: Add notification preferences query key

**Files:**
- Modify: `kapwa-client/src/lib/query-keys.ts`

**Interfaces:**
- Produces: `queryKeys.notifications.preferences()` consumed by Task 6

- [ ] **Step 1: Add preferences key**

```typescript
// kapwa-client/src/lib/query-keys.ts — inside notifications block
preferences: () => memo('notifications.preferences', () => ['notifications', 'preferences'] as const),
```

So the notifications block becomes:

```typescript
notifications: {
  all: ['notifications'] as const,
  list: () => memo('notifications.list', () => ['notifications', 'my'] as const),
  unreadCount: () => memo('notifications.unreadCount', () => ['notifications', 'unread'] as const),
  preferences: () => memo('notifications.preferences', () => ['notifications', 'preferences'] as const),
},
```

- [ ] **Step 2: Verify project compiles**

Run: `npx tsc --noEmit` in `kapwa-client/`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/lib/query-keys.ts
git commit -m "feat(client): add notification preferences query key"
```

---

### Task 6: Create SettingsPage with Profile, Security, and Notifications tabs

**Files:**
- Create: `kapwa-client/src/pages/SettingsPage.tsx`

**Interfaces:**
- Consumes: `queryKeys` from Task 5; existing `api` from `src/lib/api.ts`; existing `MfaSetupPage` flow; existing shadcn/ui components

- [ ] **Step 1: Write the full SettingsPage component**

```tsx
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
import { Separator } from '@/components/ui/separator';
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

  // Change email
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

  // Change password
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
      {/* Profile Info */}
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

      {/* Change Email */}
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

      {/* Change Password */}
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
        return current.map(p =>
          p.channel === arg.channel && p.category === arg.category
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
```

- [ ] **Step 2: Verify project compiles**

Run: `npx tsc --noEmit` in `kapwa-client/`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/pages/SettingsPage.tsx
git commit -m "feat(client): add unified SettingsPage with Profile, Security, Notifications tabs"
```

---

### Task 7: Wire up settings route, nav, and topbar

**Files:**
- Modify: `kapwa-client/src/routes.tsx`
- Modify: `kapwa-client/src/lib/nav-config.tsx`
- Modify: `kapwa-client/src/components/Topbar.tsx`

**Interfaces:**
- Consumes: `SettingsPage` from Task 6

- [ ] **Step 1: Add route and redirect in routes.tsx**

Add import:

```typescript
// kapwa-client/src/routes.tsx — after MfaSetupPage import
import { SettingsPage } from './pages/SettingsPage';
```

Add route after `/settings/mfa`:

```typescript
{ path: '/settings', element: <Private><SettingsPage /></Private> },
```

Modify `*` catch-all to also redirect `/settings/mfa` → `/settings`:

Add below the `/settings/mfa` route:

```typescript
{ path: '/settings/mfa', element: <Navigate to="/settings" replace /> },
```

The route block for mfa at line 76 currently is:
```
{ path: '/settings/mfa', element: <Private roles={['admin','mayor','auditor']}><MfaSetupPage /></Private> },
```

Change to:
```
{ path: '/settings/mfa', element: <Navigate to="/settings" replace /> },
```

And add after it:
```
{ path: '/settings', element: <Private><SettingsPage /></Private> },
```

Note: The MFA tab in SettingsPage still enforces role restrictions internally.

- [ ] **Step 2: Update nav-config.tsx**

Replace the MFA Settings nav item with a general Settings item:

```typescript
// Change line 43
{ path: '/settings/mfa', label: 'MFA Settings', icon: <Shield size={20} />, roles: ['admin', 'mayor', 'auditor'] },

// To
{ path: '/settings', label: 'Settings', icon: <Settings size={20} />, roles: ['admin', 'social_worker', 'coordinator', 'mayor', 'auditor', 'claimant'] },
```

Add `Settings` to the import from lucide-react at the top of the file:

```typescript
import { ..., Settings } from 'lucide-react';
```

- [ ] **Step 3: Update Topbar.tsx**

Change the MFA Settings dropdown menu item to Settings:

```typescript
// Line 158-163 — replace:
<DropdownMenuItem asChild>
  <Link to="/settings/mfa" className="flex items-center gap-2 no-underline">
    <Settings size={16} />
    MFA Settings
  </Link>
</DropdownMenuItem>

// With:
<DropdownMenuItem asChild>
  <Link to="/settings" className="flex items-center gap-2 no-underline">
    <Settings size={16} />
    Settings
  </Link>
</DropdownMenuItem>
```

- [ ] **Step 4: Verify project compiles**

Run: `npx tsc --noEmit` in `kapwa-client/`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add kapwa-client/src/routes.tsx kapwa-client/src/lib/nav-config.tsx kapwa-client/src/components/Topbar.tsx
git commit -m "feat(client): wire settings route, nav, and topbar link"
```

---

### Task 8: Add tests for SettingsPage

**Files:**
- Create: `kapwa-client/src/pages/SettingsPage.test.tsx`

- [ ] **Step 1: Write tests**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth-context';
import { SWRConfig } from 'swr';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

function renderWithProviders(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>
      <BrowserRouter>
        <AuthProvider>
          {ui}
        </AuthProvider>
      </BrowserRouter>
    </SWRConfig>
  );
}

describe('SettingsPage', () => {
  it('renders all three tab triggers', () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByRole('tab', { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /security/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /notifications/i })).toBeInTheDocument();
  });

  it('shows profile content by default', () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText(/profile information/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/pages/SettingsPage.test.tsx` in `kapwa-client/`
Expected: Tests pass

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/pages/SettingsPage.test.tsx
git commit -m "test(client): add SettingsPage tests"
```
