import { useState } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { Bell, Calendar, CheckCircle, DollarSign, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Payout {
  id: string;
  cycleNo?: string;
  scheduledAt: string;
  amount?: number;
  status: 'scheduled' | 'completed' | 'missed' | 'cancelled';
  notifiedAt?: string;
  remarks?: string;
}

// DSWD 4Ps payout cycles for a case: schedule a cycle, notify the household,
// then mark it completed / missed / cancelled. A completed payout is logged to
// the household access card and recorded as a case intervention by the API.
export function FourPsPayoutsSection({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const { data, isLoading, mutate } = useSWR<Payout[]>(caseId ? queryKeys.fourps.payouts(caseId) : null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ scheduledAt: '', cycleNo: '', amount: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const payouts = data ?? [];

  async function handleSchedule() {
    if (!caseId || !form.scheduledAt) return;
    setSaving(true);
    setError('');
    try {
      await api.post(`/fourps/${caseId}/payouts`, {
        scheduledAt: form.scheduledAt,
        cycleNo: form.cycleNo || undefined,
        amount: form.amount ? Number(form.amount) : undefined,
      });
      setShowForm(false);
      setForm({ scheduledAt: '', cycleNo: '', amount: '' });
      await mutate();
    } catch {
      setError(t('payouts.actionFailed', 'Action failed. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: 'completed' | 'missed' | 'cancelled') {
    setPendingId(id);
    setError('');
    try {
      await api.patch(`/fourps/payouts/${id}/status`, { status });
      await mutate();
    } catch {
      setError(t('payouts.actionFailed', 'Action failed. Please try again.'));
    } finally {
      setPendingId(null);
    }
  }

  async function notify(id: string) {
    setPendingId(id);
    setError('');
    try {
      await api.post(`/fourps/payouts/${id}/notify`);
      await mutate();
    } catch {
      setError(t('payouts.actionFailed', 'Action failed. Please try again.'));
    } finally {
      setPendingId(null);
    }
  }

  const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    scheduled: 'outline',
    completed: 'default',
    missed: 'destructive',
    cancelled: 'secondary',
  };

  return (
    <div>
      {error && (
        <div role="alert" className="rounded-lg bg-destructive/10 border px-4 py-3 text-sm text-destructive mb-4">{error}</div>
      )}

      <div className="mb-4">
        <Button onClick={() => setShowForm(true)}>
          <Calendar size={14} className="mr-1" /> {t('payouts.schedule', 'Schedule Payout')}
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('payouts.schedule', 'Schedule Payout')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="date"
              aria-label={t('payouts.date', 'Payout Date')}
              value={form.scheduledAt}
              onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))}
            />
            <Input
              placeholder={t('payouts.cyclePlaceholder', 'e.g. CY2026-02')}
              aria-label={t('payouts.cycle', 'Cycle')}
              value={form.cycleNo}
              onChange={e => setForm(p => ({ ...p, cycleNo: e.target.value }))}
            />
            <Input
              type="number"
              placeholder={t('payouts.amount', 'Amount (₱)')}
              aria-label={t('payouts.amount', 'Amount (₱)')}
              value={form.amount}
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
            />
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            <Button className="w-full" onClick={handleSchedule} disabled={saving}>
              {t('payouts.save', 'Save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <p className="text-muted-foreground">{t('payouts.loading', 'Loading…')}</p>
      ) : payouts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <DollarSign className="mx-auto mb-2" size={32} />
          <p>{t('payouts.empty', 'No payout schedules yet.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payouts.map(payout => (
            <div key={payout.id} className="rounded-lg border bg-card shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold">
                    {new Date(payout.scheduledAt).toLocaleDateString('en-PH', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                  {payout.cycleNo && <span className="ml-3 text-xs text-muted-foreground">{payout.cycleNo}</span>}
                  {payout.amount != null && (
                    <span className="ml-3 text-lg font-bold">₱{Number(payout.amount).toLocaleString()}</span>
                  )}
                </div>
                <Badge variant={statusVariant[payout.status] || 'outline'}>
                  {t(`payouts.status.${payout.status}`, { defaultValue: payout.status })}
                </Badge>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {payout.status === 'scheduled' && (
                  <>
                    <Button size="sm" variant="outline" disabled={pendingId === payout.id} onClick={() => notify(payout.id)}>
                      <Bell size={14} className="mr-1" /> {t('payouts.notify', 'Notify')}
                    </Button>
                    <Button size="sm" variant="default" disabled={pendingId === payout.id} onClick={() => setStatus(payout.id, 'completed')}>
                      <CheckCircle size={14} className="mr-1" /> {t('payouts.markCompleted', 'Mark Completed')}
                    </Button>
                    <Button size="sm" variant="destructive" disabled={pendingId === payout.id} onClick={() => setStatus(payout.id, 'missed')}>
                      <XCircle size={14} className="mr-1" /> {t('payouts.markMissed', 'Mark Missed')}
                    </Button>
                    <Button size="sm" variant="outline" disabled={pendingId === payout.id} onClick={() => setStatus(payout.id, 'cancelled')}>
                      {t('payouts.cancelPayout', 'Cancel Payout')}
                    </Button>
                  </>
                )}
                {payout.notifiedAt && (
                  <span className="text-xs text-muted-foreground">
                    {t('payouts.notified', 'Notified: {{date}}', { date: new Date(payout.notifiedAt).toLocaleString() })}
                  </span>
                )}
              </div>
              {payout.remarks && <p className="mt-1 text-xs text-muted-foreground">{payout.remarks}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
