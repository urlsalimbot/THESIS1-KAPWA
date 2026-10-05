import { useState, useEffect } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import useSWRMutation from 'swr/mutation';
import QRCode from 'qrcode';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { useAuth } from '@/lib/auth-context';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/errors';
import { Shield, Smartphone, CheckCircle, Mail, Lock, Bell, User, Copy, Eye, EyeOff, KeyRound, Languages, Phone, Save, AlarmClock } from 'lucide-react';
import { useLanguage } from '@/i18n/useLanguage';

interface NotificationPref {
  id: string;
  userId: string;
  channel: 'sms' | 'in_app' | 'email';
  category: string;
  optedIn: boolean;
}

const CHANNELS = ['in_app', 'sms', 'email'] as const;
const CATEGORIES = ['case_update', 'approval', 'disbursement', 'chat', 'sync_conflict', 'system', 'court_hearing', 'home_visit'] as const;

const categoryLabels: Record<string, { key: string; label: string }> = {
  case_update: { key: 'settings.catCaseUpdate', label: 'Case Updates' },
  approval: { key: 'settings.catApproval', label: 'Approvals' },
  disbursement: { key: 'settings.catDisbursement', label: 'Disbursements' },
  chat: { key: 'settings.catChat', label: 'Chat Messages' },
  sync_conflict: { key: 'settings.catSyncConflict', label: 'Sync Conflicts' },
  system: { key: 'settings.catSystem', label: 'System Notifications' },
  court_hearing: { key: 'settings.catCourtHearing', label: 'Court Hearings' },
  home_visit: { key: 'settings.catHomeVisit', label: 'Home Visits' },
};

const channelLabels: Record<string, { key: string; label: string }> = {
  in_app: { key: 'settings.channelInApp', label: 'In-App' },
  sms: { key: 'settings.channelSms', label: 'SMS' },
  email: { key: 'settings.channelEmail', label: 'Email' },
};

interface ReminderRow {
  eventType: string;
  offsets: number[];
}

const REMINDER_EVENT_TYPES = ['court_hearing', 'home_visit'] as const;
const OFFSET_PRESETS = [
  { minutes: 4320, key: 'settings.reminder3d', label: '3 days' },
  { minutes: 1440, key: 'settings.reminder1d', label: '1 day' },
  { minutes: 180, key: 'settings.reminder3h', label: '3 hours' },
] as const;

function reminderEventLabel(key: string): { key: string; label: string } {
  return key === 'court_hearing'
    ? { key: 'settings.reminderCourtHearing', label: 'Court Hearing' }
    : { key: 'settings.reminderHomeVisit', label: 'Home Visit' };
}

/**
 * Lead-time configuration for hearing/visit reminders: workers edit their own
 * overrides (an empty list means no reminders for them), admins additionally
 * edit the system defaults everyone inherits. The effective list is the
 * worker's override when present, else the system default.
 */
function ReminderSettingsCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data: mine, mutate: mutateMine } = useSWR<ReminderRow[]>('/reminder-settings/me');
  const { data: system, mutate: mutateSystem } = useSWR<ReminderRow[]>('/reminder-settings/system');
  const [draft, setDraft] = useState<Record<string, number[]>>({});
  const [seeded, setSeeded] = useState(false);
  const [systemDraft, setSystemDraft] = useState<Record<string, number[]>>({});
  const [systemSeeded, setSystemSeeded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (seeded || !Array.isArray(mine) || !Array.isArray(system)) return;
    const next: Record<string, number[]> = {};
    for (const type of REMINDER_EVENT_TYPES) {
      const own = mine.find((r) => r.eventType === type);
      const fallback = system.find((r) => r.eventType === type);
      next[type] = own ? [...(own.offsets ?? [])] : [...(fallback?.offsets ?? [])];
    }
    setDraft(next);
    setSeeded(true);
  }, [mine, system, seeded]);

  useEffect(() => {
    if (systemSeeded || !Array.isArray(system)) return;
    const next: Record<string, number[]> = {};
    for (const type of REMINDER_EVENT_TYPES) {
      next[type] = [...(system.find((r) => r.eventType === type)?.offsets ?? [])];
    }
    setSystemDraft(next);
    setSystemSeeded(true);
  }, [system, systemSeeded]);

  function toggle(list: number[], minutes: number): number[] {
    return list.includes(minutes)
      ? list.filter((m) => m !== minutes)
      : [...list, minutes].sort((a, b) => b - a);
  }

  async function saveMine() {
    setSaving(true);
    try {
      const rows = REMINDER_EVENT_TYPES.map((type) => ({ eventType: type, offsets: draft[type] ?? [] }));
      await api.put('/reminder-settings/me', rows);
      await mutateMine();
      toast.success(t('settings.remindersSaved', 'Reminder settings saved'));
    } catch {
      toast.error(t('settings.remindersSaveFailed', 'Could not save reminder settings'));
    } finally {
      setSaving(false);
    }
  }

  async function saveSystem() {
    setSaving(true);
    try {
      const rows = REMINDER_EVENT_TYPES.map((type) => ({ eventType: type, offsets: systemDraft[type] ?? [] }));
      await api.put('/reminder-settings/system', rows);
      await mutateSystem();
      toast.success(t('settings.remindersSaved', 'Reminder settings saved'));
    } catch {
      toast.error(t('settings.remindersSaveFailed', 'Could not save reminder settings'));
    } finally {
      setSaving(false);
    }
  }

  function chips(list: number[], onToggle: (minutes: number) => void) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {OFFSET_PRESETS.map((preset) => {
          const active = list.includes(preset.minutes);
          return (
            <button
              key={preset.minutes}
              type="button"
              onClick={() => onToggle(preset.minutes)}
              aria-pressed={active}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {t(preset.key, preset.label)}
            </button>
          );
        })}
        {list.length === 0 && (
          <span className="text-xs text-muted-foreground">{t('settings.remindersOff', 'No reminders')}</span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
        <AlarmClock size={16} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">{t('settings.reminders', 'Reminder Settings')}</h2>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          {t('settings.remindersHint', 'When to remind the assigned worker before a court hearing or a scheduled home visit. Several lead times can be chained.')}
        </p>
        {REMINDER_EVENT_TYPES.map((type) => {
          const label = reminderEventLabel(type);
          return (
            <div key={type} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{t(label.key, label.label)}</span>
              {chips(draft[type] ?? [], (minutes) => setDraft((d) => ({ ...d, [type]: toggle(d[type] ?? [], minutes) })))}
            </div>
          );
        })}
        <div className="flex justify-end">
          <Button size="sm" onClick={saveMine} disabled={saving}>
            <Save size={14} className="mr-1.5" aria-hidden="true" />
            {saving ? t('settings.saving', 'Saving...') : t('settings.remindersSaveMine', 'Save my reminders')}
          </Button>
        </div>

        {isAdmin && (
          <div className="border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {t('settings.remindersSystem', 'System defaults (all workers inherit these)')}
            </p>
            {REMINDER_EVENT_TYPES.map((type) => {
              const label = reminderEventLabel(type);
              return (
                <div key={type} className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="text-sm">{t(label.key, label.label)}</span>
                  {chips(systemDraft[type] ?? [], (minutes) => setSystemDraft((d) => ({ ...d, [type]: toggle(d[type] ?? [], minutes) })))}
                </div>
              );
            })}
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={saveSystem} disabled={saving}>
                {t('settings.remindersSaveSystem', 'Save system defaults')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileTab() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const { lang, setLang } = useLanguage();

  const [newEmail, setNewEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const changeEmail = useSWRMutation(
    'change-email',
    async (_key: string, { arg }: { arg: { newEmail: string; currentPassword: string } }) => {
      return api.post('/auth/change-email', arg);
    },
    {
      onSuccess: () => {
        setNewEmail('');
        setEmailPw('');
        toast.success(t('settings.verificationSent', 'Verification sent'), { description: t('settings.checkNewEmail', 'Check your new email inbox.') });
      },
      onError: (err) => {
        toast.error(t('settings.emailUpdateFailed', 'Failed to update email'), { description: humanizeError(err) });
      },
    },
  );

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const changePassword = useSWRMutation(
    'change-password',
    async (_key: string, { arg }: { arg: { currentPassword: string; newPassword: string } }) => {
      return api.post('/auth/change-password', arg);
    },
    {
      onSuccess: () => {
        toast.success(t('settings.passwordChanged', 'Password changed'), { description: t('settings.passwordUpdated', 'Your password has been updated.') });
        setCurrentPw('');
        setNewPw('');
        setConfirmPw('');
        setPwError('');
        // Clear the must_change_password gate (staff-provisioned accounts).
        refresh();
      },
      onError: (err) => {
        toast.error(t('settings.passwordChangeFailed', 'Failed to change password'), { description: humanizeError(err) });
      },
    },
  );

  const [phone, setPhone] = useState(user?.phone || '');
  const [phoneSaving, setPhoneSaving] = useState(false);
  // The server is the source of truth after a save; hold its response so the
  // "Current:" line reflects the just-saved number without waiting on a reload
  // or a /auth/me round-trip.
  const [savedPhone, setSavedPhone] = useState<string | null>(null);
  const displayPhone = savedPhone ?? user?.phone ?? '';

  async function handleSavePhone() {
    if (!phone || phone.length < 10) {
      toast.error(t('settings.invalidPhone', 'Invalid phone number'), { description: t('settings.validPhoneHint', 'Please enter a valid phone number.') });
      return;
    }
    setPhoneSaving(true);
    try {
      const res = await api.post<{ phone?: string }>('/auth/update-phone', { phone });
      setSavedPhone(res?.phone ?? phone);
      toast.success(t('settings.phoneUpdated', 'Phone number updated'), { description: t('settings.contactSaved', 'Your contact info has been saved.') });
      globalMutate(queryKeys.auth.me());
      // Sync the auth-context user so other shell surfaces (topbar, popovers)
      // show the new number too.
      refresh();
    } catch (err: any) {
      toast.error(t('settings.phoneUpdateFailed', 'Failed to update phone'), { description: humanizeError(err) });
    } finally {
      setPhoneSaving(false);
    }
  }

  function handleChangePassword() {
    setPwError('');
    if (newPw !== confirmPw) {
      setPwError(t('settings.passwordsDontMatch', 'Passwords do not match'));
      return;
    }
    if (newPw.length < 8) {
      setPwError(t('settings.passwordMin', 'New password must be at least 8 characters'));
      return;
    }
    changePassword.trigger({ currentPassword: currentPw, newPassword: newPw });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Languages size={18} className="text-primary" />
          <h3 className="text-sm font-semibold">{t('settings.languagePreference', 'Language Preference')}</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('settings.languageHint', 'Choose the language used across the app.')}
        </p>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="language"
              value="en"
              checked={lang === 'en'}
              onChange={() => setLang('en')}
              className="accent-primary"
              aria-label={t('settings.english', 'English')}
            />
            {t('settings.english', 'English')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="language"
              value="fil"
              checked={lang === 'fil'}
              onChange={() => setLang('fil')}
              className="accent-primary"
              aria-label={t('settings.filipino', 'Filipino')}
            />
            {t('settings.filipino', 'Filipino')}
          </label>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
          <User size={16} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{t('settings.profileInfo', 'Profile Information')}</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">{t('settings.email', 'Email')}</span>
              <p className="text-sm font-medium text-foreground">{user?.email}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">{t('settings.fullName', 'Full Name')}</span>
              <p className="text-sm font-medium text-foreground">{user?.fullName}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">{t('settings.role', 'Role')}</span>
              <p className="text-sm font-medium text-foreground capitalize">{user?.role?.replace(/_/g, ' ')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
          <Smartphone size={16} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{t('settings.smsPhone', 'SMS / Phone Number')}</h2>
        </div>
        <div className="p-4">
          <div className="flex items-end gap-3">
            <div className="space-y-1.5 flex-1">
              <label className="text-xs text-muted-foreground font-medium">{t('settings.phoneNumber', 'Phone Number')}</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="tel"
                  placeholder="+639123456789"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="pl-9 h-9"
                  aria-label={t('settings.phoneNumber', 'Phone Number')}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t('settings.phoneHint', 'Used for SMS notifications and login OTP verification')}
              </p>
            </div>
            <Button onClick={handleSavePhone} disabled={phoneSaving || !phone || phone === displayPhone} className="gap-1.5 shrink-0">
              <Save size={14} />
              {phoneSaving ? t('settings.saving', 'Saving...') : t('settings.save', 'Save')}
            </Button>
          </div>
          {displayPhone && (
            <div className="mt-3 rounded-lg bg-muted/30 border border-border/60 px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle size={14} className="text-emerald-500 shrink-0" />
              {t('settings.current', 'Current:')} <span className="font-medium text-foreground">{displayPhone}</span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
          <Mail size={16} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{t('settings.changeEmail', 'Change Email')}</h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            changeEmail.trigger({ newEmail, currentPassword: emailPw });
          }}
          className="p-4 space-y-4"
        >
          <p className="text-xs text-muted-foreground">{t('settings.changeEmailHint', 'A verification link will be sent to your new address.')}</p>
          <div className="space-y-1.5">
            <label htmlFor="new-email" className="text-xs text-muted-foreground font-medium">{t('settings.newEmail', 'New Email')}</label>
            <Input id="new-email" type="email" autoComplete="email" placeholder="your@newemail.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="email-pw" className="text-xs text-muted-foreground font-medium">{t('settings.confirmPassword', 'Confirm Password')}</label>
            <Input id="email-pw" type="password" autoComplete="current-password" placeholder={t('settings.currentPasswordPlaceholder', 'Enter your current password')} value={emailPw} onChange={e => setEmailPw(e.target.value)} className="h-9" />
          </div>
          <Button
            type="submit"
            disabled={changeEmail.isMutating || !newEmail || !emailPw}
            className="gap-2"
          >
            {changeEmail.isMutating ? t('settings.sendingVerification', 'Sending verification...') : t('settings.updateEmail', 'Update Email')}
          </Button>
        </form>
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
          <Lock size={16} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{t('settings.changePassword', 'Change Password')}</h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleChangePassword();
          }}
          className="p-4 space-y-4"
        >
          <p className="text-xs text-muted-foreground">{t('settings.passwordMinHint', 'Password must be at least 8 characters.')}</p>
          <div className="space-y-1.5">
            <label htmlFor="current-pw" className="text-xs text-muted-foreground font-medium">{t('settings.currentPassword', 'Current Password')}</label>
            <div className="relative">
              <Input
                id="current-pw"
                type={showCurrentPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder={t('settings.currentPasswordPlaceholder', 'Enter current password')}
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                className="pr-10 h-9"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                aria-label={showCurrentPw ? t('settings.hidePassword', 'Hide password') : t('settings.showPassword', 'Show password')}
                aria-pressed={showCurrentPw}
              >
                {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="new-pw" className="text-xs text-muted-foreground font-medium">{t('settings.newPassword', 'New Password')}</label>
              <div className="relative">
                <Input
                  id="new-pw"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder={t('settings.minChars', 'Min. 8 characters')}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  className="pr-10 h-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                  aria-label={showPw ? t('settings.hidePassword', 'Hide password') : t('settings.showPassword', 'Show password')}
                  aria-pressed={showPw}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="confirm-pw" className="text-xs text-muted-foreground font-medium">{t('settings.confirmNewPassword', 'Confirm New Password')}</label>
              <div className="relative">
                <Input
                  id="confirm-pw"
                  type={showConfirmPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder={t('settings.repeatPassword', 'Repeat new password')}
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  className="pr-10 h-9"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                  aria-label={showConfirmPw ? t('settings.hidePassword', 'Hide password') : t('settings.showPassword', 'Show password')}
                  aria-pressed={showConfirmPw}
                >
                  {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
          {pwError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {pwError}
            </div>
          )}
          <Button
            type="submit"
            disabled={changePassword.isMutating || !currentPw || !newPw || !confirmPw}
            className="gap-2"
          >
            <KeyRound size={16} />
            {changePassword.isMutating ? t('settings.changing', 'Changing...') : t('settings.changePassword', 'Change Password')}
          </Button>
        </form>
      </div>
    </div>
  );
}

function SecurityTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: userData, isLoading } = useSWR<{ mfaEnabled?: boolean; role?: string }>(queryKeys.auth.me());
  const [step, setStep] = useState<'idle' | 'setup' | 'verify' | 'done'>('idle');
  const [secret, setSecret] = useState('');
  const [otpauth, setOtpauth] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(userData?.mfaEnabled ?? false);
  const [error, setError] = useState('');
  const [disablePw, setDisablePw] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (userData) setMfaEnabled(userData.mfaEnabled ?? false);
  }, [userData]);

  async function handleSetup() {
    setError('');
    try {
      const res = await api.post<{ secret: string; otpauth: string }>('/auth/mfa/setup');
      setSecret(res.secret);
      setOtpauth(res.otpauth);
      const url = await QRCode.toDataURL(res.otpauth, { width: 200, margin: 2 });
      setQrDataUrl(url);
      setStep('setup');
    } catch (e: any) {
      setError(e.message || t('settings.mfaSetupFailed', 'Setup failed'));
    }
  }

  async function handleEnable() {
    setError('');
    try {
      const res = await api.post<{ mfaEnabled: boolean }>('/auth/mfa/enable', { code });
      setMfaEnabled(res.mfaEnabled);
      setStep('done');
      globalMutate(queryKeys.auth.me());
    } catch (e: any) {
      setError(e.message || t('settings.mfaVerificationFailed', 'Verification failed'));
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
      globalMutate(queryKeys.auth.me());
    } catch (e: any) {
      setError(e.message || t('settings.mfaDisableFailed', 'Disable failed'));
    }
  }

  async function copySecret() {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const canSetup = !!user;

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="p-8 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
          <Shield size={16} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{t('settings.mfa', 'Multi-Factor Authentication')}</h2>
        </div>
        <div className="p-4">
          {canSetup && step === 'idle' && !mfaEnabled && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="rounded-full bg-primary/10 p-5">
                <Shield className="text-primary" size={36} />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">{t('settings.mfaNotEnabled', 'MFA not enabled')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('settings.mfaProtect', 'Protect your account with an authenticator app')}</p>
              </div>
              <Button onClick={handleSetup} className="gap-2">
                <Shield size={16} />
                {t('settings.setUpMfa', 'Set Up MFA')}
              </Button>
            </div>
          )}

          {step === 'setup' && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground font-medium">{t('settings.mfaStep1', 'Step 1: Scan QR code with your authenticator app')}</p>

              {qrDataUrl && (
                <div className="flex justify-center">
                  <div className="rounded-xl border bg-white p-3 shadow-sm">
                    <img src={qrDataUrl} alt={t('settings.mfaQrAlt', 'MFA QR Code')} className="w-48 h-48" />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <span className="text-xs text-muted-foreground font-medium">{t('settings.manualKey', 'Or enter this key manually')}</span>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg border bg-muted px-4 py-3 text-sm font-mono tracking-wider break-all select-all">{secret}</code>
                  <Button variant="outline" size="sm" onClick={copySecret} className="gap-1.5 shrink-0">
                    <Copy size={14} />
                    {copied ? t('settings.copied', 'Copied!') : t('settings.copy', 'Copy')}
                  </Button>
                </div>
              </div>

              {otpauth && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 space-y-1">
                  <p className="font-medium">{t('settings.mfaStep2', 'Step 2: Verify setup')}</p>
                  <p className="text-emerald-600">{t('settings.mfaEnterCode', 'Enter the 6-digit code from your authenticator app below.')}</p>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Input
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  className="flex-1 text-center text-2xl tracking-[0.5em] font-mono h-14"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                />
                <Button onClick={handleEnable} disabled={code.length !== 6} className="px-6">
                  {t('settings.verifyAndEnable', 'Verify & Enable')}
                </Button>
              </div>
            </div>
          )}

          {step === 'done' && mfaEnabled && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="rounded-full bg-emerald-100 p-5">
                <CheckCircle className="text-emerald-600" size={36} />
              </div>
              <div className="text-center">
                <p className="font-medium text-emerald-800">{t('settings.mfaEnabled', 'MFA is enabled')}</p>
                <p className="text-sm text-emerald-600 mt-1">{t('settings.mfaEnabledDesc', 'Your account is now protected with TOTP.')}</p>
              </div>
              <Button variant="outline" onClick={() => { setStep('idle'); setCode(''); }}>
                {t('settings.done', 'Done')}
              </Button>
            </div>
          )}

          {mfaEnabled && (
            <div className="mt-4 pt-4 border-t border-border space-y-4">
              <div>
                <h4 className="text-sm font-medium text-foreground">{t('settings.disableMfa', 'Disable MFA')}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{t('settings.disableMfaHint', 'Enter your password to confirm disabling MFA')}</p>
              </div>
              <div className="flex gap-3">
                <Input type="password" placeholder={t('settings.currentPassword', 'Current password')} value={disablePw} onChange={e => setDisablePw(e.target.value)} className="max-w-xs h-9" />
                <Button variant="destructive" onClick={handleDisable} disabled={!disablePw}>
                  {t('settings.disable', 'Disable')}
                </Button>
              </div>
              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>


    </div>
  );
}

function NotificationsTab() {
  const { t } = useTranslation();
  const { data: prefs, isLoading, mutate: revalidatePrefs } = useSWR<NotificationPref[]>(queryKeys.notifications.preferences());
  // Public config: hide the SMS column when Twilio is not configured server-side.
  const { data: config } = useSWR<{ smsEnabled?: boolean }>(queryKeys.config.public(), { fallbackData: { smsEnabled: true } });
  const visibleChannels = config?.smsEnabled === false ? CHANNELS.filter(c => c !== 'sms') : CHANNELS;
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [draftSynced, setDraftSynced] = useState(false);
  const [saving, setSaving] = useState(false);

  // Seed the draft from server preferences once they load. Toggles only stage
  // changes locally; they are applied via a deliberate "Save preferences" action
  // (single bulk write to the preferences API — the opt-in/opt-out mechanism).
  useEffect(() => {
    if (draftSynced || !Array.isArray(prefs)) return;
    const next: Record<string, boolean> = {};
    for (const cat of CATEGORIES) {
      for (const channel of CHANNELS) {
        const pref = prefs.find(p => p.channel === channel && p.category === cat);
        next[`${channel}:${cat}`] = pref ? pref.optedIn : false;
      }
    }
    setDraft(next);
    setDraftSynced(true);
  }, [prefs, draftSynced]);

  function serverValue(channel: string, category: string): boolean {
    if (!Array.isArray(prefs)) return false;
    const pref = prefs.find(p => p.channel === channel && p.category === category);
    return pref ? pref.optedIn : false;
  }

  function isOptedIn(channel: string, category: string): boolean {
    return draft[`${channel}:${category}`] ?? serverValue(channel, category);
  }

  const hasChanges = CATEGORIES.some(cat =>
    CHANNELS.some(ch => isOptedIn(ch, cat) !== serverValue(ch, cat)),
  );

  function handleToggle(channel: string, category: string) {
    const key = `${channel}:${category}`;
    setDraft(prev => ({ ...prev, [key]: !isOptedIn(channel, category) }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const rows = CATEGORIES.flatMap(cat =>
        CHANNELS.map(ch => ({ channel: ch, category: cat, optedIn: isOptedIn(ch, cat) })),
      );
      await api.put('/notifications/preferences/bulk', rows);
      await revalidatePrefs();
      toast.success(t('settings.prefsSaved', 'Preferences saved'), {
        description: t('settings.prefsSavedDesc', 'Your notification preferences have been updated.'),
      });
    } catch {
      toast.error(t('settings.prefSaveFailed', 'Failed to save preferences'), {
        description: t('settings.tryAgain', 'Please try again.'),
      });
    } finally {
      setSaving(false);
    }
  }

  const categoryIcons: Record<string, string> = {
    case_update: '📋',
    approval: '✅',
    disbursement: '💰',
    chat: '💬',
    sync_conflict: '⚠️',
    system: '🔔',
    court_hearing: '⚖️',
    home_visit: '🏠',
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
          <Bell size={16} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{t('settings.notificationPrefs', 'Notification Preferences')}</h2>
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-4 animate-pulse">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-6 w-10 bg-muted rounded-full ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
          <Bell size={16} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{t('settings.notificationPrefs', 'Notification Preferences')}</h2>
        </div>
        <div className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">{t('settings.category', 'Category')}</th>
                {visibleChannels.map(ch => (
                  <th key={ch} className="text-center px-4 py-2.5 text-xs text-muted-foreground font-medium">{channelLabels[ch] ? t(channelLabels[ch].key, channelLabels[ch].label) : ch}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {CATEGORIES.map(cat => (
                <tr key={cat} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg shrink-0">{categoryIcons[cat]}</span>
                      <span className="text-sm font-medium text-foreground">{categoryLabels[cat] ? t(categoryLabels[cat].key, categoryLabels[cat].label) : cat}</span>
                    </div>
                  </td>
                  {visibleChannels.map(channel => (
                    <td key={channel} className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggle(channel, cat)}
                        disabled={saving}
                        className={`inline-flex h-6 w-10 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                          isOptedIn(channel, cat) ? 'bg-primary' : 'bg-input'
                        }`}
                        role="switch"
                        aria-checked={isOptedIn(channel, cat)}
                        aria-label={t('settings.toggleAria', '{{category}} {{channel}}', { category: categoryLabels[cat] ? t(categoryLabels[cat].key, categoryLabels[cat].label) : cat, channel: channelLabels[channel] ? t(channelLabels[channel].key, channelLabels[channel].label) : channel })}
                      >
                        <span
                          className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                            isOptedIn(channel, cat) ? 'translate-x-[1.125rem]' : 'translate-x-[0.125rem]'
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
        <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3">
          <p className="text-xs text-muted-foreground">{t('settings.prefsHint', 'Changes apply after you save.')}</p>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges || saving}>
            <Save size={14} className="mr-1.5" aria-hidden="true" />
            {saving ? t('settings.saving', 'Saving...') : t('settings.prefsSave', 'Save preferences')}
          </Button>
        </div>
      </div>

      <ReminderSettingsCard />
    </div>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile');

  return (
    <PageShell title={t('settings.title', 'Settings')} description={t('settings.description', 'Manage your account settings and preferences.')}>
      <div role="tablist" aria-label={t('settings.tabsAria', 'Settings sections')} className="flex gap-1 rounded-lg bg-muted p-1 w-fit mb-4">
        <button
          role="tab"
          aria-selected={activeTab === 'profile'}
          aria-controls="settings-profile"
          id="settings-tab-profile"
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'profile' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <User size={16} className="inline mr-1.5" />
          {t('settings.profile', 'Profile')}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'security'}
          aria-controls="settings-security"
          id="settings-tab-security"
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'security' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Shield size={16} className="inline mr-1.5" />
          {t('settings.security', 'Security')}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'notifications'}
          aria-controls="settings-notifications"
          id="settings-tab-notifications"
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'notifications' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Bell size={16} className="inline mr-1.5" />
          {t('settings.notifications', 'Notifications')}
        </button>
      </div>

      <div
        role="tabpanel"
        id="settings-profile"
        aria-labelledby="settings-tab-profile"
        hidden={activeTab !== 'profile'}
      >
        {activeTab === 'profile' && <ProfileTab />}
      </div>
      <div
        role="tabpanel"
        id="settings-security"
        aria-labelledby="settings-tab-security"
        hidden={activeTab !== 'security'}
      >
        {activeTab === 'security' && <SecurityTab />}
      </div>
      <div
        role="tabpanel"
        id="settings-notifications"
        aria-labelledby="settings-tab-notifications"
        hidden={activeTab !== 'notifications'}
      >
        {activeTab === 'notifications' && <NotificationsTab />}
      </div>
    </PageShell>
  );
}
