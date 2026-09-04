import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { categoryLabel } from '@/i18n/display';
import { CreditCard, Banknote, ClipboardCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface CardService {
  id: string;
  accessCardCode: string;
  serviceDate: string;
  serviceRendered: string;
  cost?: number;
  category?: string;
}

interface CardDetail {
  beneficiary: { id: string; firstName: string; surname: string };
  code: string;
  services: CardService[];
}

// The access card is the accounting vehicle for a case: payouts and compliance
// checkoffs for recurring programs (e.g. 4Ps) are logged against the household
// card and surface here and on the access card view.
export function CaseAccessCardPanel({ beneficiaryId, cardCode }: { beneficiaryId: string; cardCode?: string }) {
  const { t } = useTranslation();
  const { mutate: globalMutate } = useSWRConfig();
  const [dialog, setDialog] = useState<'payout' | 'compliance' | null>(null);
  const [form, setForm] = useState({ serviceRendered: '', serviceDate: '', cost: '', workerNameSign: '' });
  const [saving, setSaving] = useState(false);

  const { data: cardData } = useSWR<CardDetail>(
    beneficiaryId ? queryKeys.accessCards.detail(beneficiaryId) : null,
  );
  const code = cardData?.code || cardCode;
  const services = cardData?.services || [];

  const payouts = services.filter(s => s.category === 'payout');
  const compliance = services.filter(s => s.category === 'compliance');

  async function handleLog(e: React.FormEvent) {
    e.preventDefault();
    if (!code || !dialog) return;
    setSaving(true);
    try {
      await api.post('/access-cards/log', {
        accessCardCode: code,
        serviceRendered: form.serviceRendered,
        serviceDate: form.serviceDate,
        cost: form.cost ? Number(form.cost) : undefined,
        workerNameSign: form.workerNameSign || undefined,
        category: dialog,
      });
      toast.success(t('caseView.cardLogged', 'Logged to card {{code}}', { code }));
      setDialog(null);
      setForm({ serviceRendered: '', serviceDate: '', cost: '', workerNameSign: '' });
      globalMutate(queryKeys.accessCards.detail(beneficiaryId));
    } catch {
      toast.error(t('caseView.cardLogFailed', 'Failed to log entry'));
    } finally {
      setSaving(false);
    }
  }

  const recent = [...services].sort((a, b) => (a.serviceDate < b.serviceDate ? 1 : -1)).slice(0, 5);

  return (
    <div className="rounded-lg border bg-card">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">{t('caseView.cardLedger', 'Access Card Ledger')}</h3>
        </div>
        {code && <Badge variant="outline" className="text-[10px] font-mono">{code}</Badge>}
      </div>
      <Separator />
      <div className="px-4 py-3 space-y-2 text-sm">
        {!code ? (
          <p className="text-xs text-muted-foreground">{t('caseView.cardNoCard', 'No access card assigned to this household.')}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Banknote size={12} /> {t('caseView.cardPayouts', 'Payouts: {{count}}', { count: payouts.length })}
              </span>
              <span className="inline-flex items-center gap-1">
                <ClipboardCheck size={12} /> {t('caseView.cardCompliance', 'Compliance: {{count}}', { count: compliance.length })}
              </span>
            </div>
            {recent.length > 0 ? (
              <div className="space-y-1.5">
                {recent.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs truncate">{s.serviceRendered}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(s.serviceDate).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.cost != null && <span className="text-xs tabular-nums">₱{Number(s.cost).toLocaleString()}</span>}
                      <Badge variant="secondary" className="text-[10px]">{categoryLabel(t, s.category || 'referral')}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t('caseView.cardNoEntries', 'No card entries yet.')}</p>
            )}
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setDialog('payout'); setForm({ ...form, serviceDate: new Date().toISOString().slice(0, 10) }); }}>
                <Banknote size={13} className="mr-1" /> {t('caseView.cardLogPayout', 'Log Payout')}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setDialog('compliance'); setForm({ ...form, serviceDate: new Date().toISOString().slice(0, 10) }); }}>
                <ClipboardCheck size={13} className="mr-1" /> {t('caseView.cardLogCompliance', 'Log Compliance')}
              </Button>
            </div>
          </>
        )}
      </div>

      <Dialog open={!!dialog} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog === 'payout' ? t('caseView.cardPayoutTitle', 'Log Payout') : t('caseView.cardComplianceTitle', 'Log Compliance Item')}
            </DialogTitle>
            <DialogDescription>
              {t('caseView.cardLogDesc', 'Recorded against card {{code}}', { code })}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLog} className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="card-service">{t('caseView.cardServiceLabel', 'Service / Item *')}</Label>
              <Input
                id="card-service"
                value={form.serviceRendered}
                onChange={e => setForm({ ...form, serviceRendered: e.target.value })}
                placeholder={dialog === 'payout' ? '4Ps Payout — Cycle 2026-01' : 'Health compliance — checkup attended'}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="card-date">{t('caseView.cardDateLabel', 'Date *')}</Label>
                <Input id="card-date" type="date" value={form.serviceDate} onChange={e => setForm({ ...form, serviceDate: e.target.value })} required />
              </div>
              {dialog === 'payout' && (
                <div className="space-y-1">
                  <Label htmlFor="card-cost">{t('caseView.cardCostLabel', 'Amount (₱)')}</Label>
                  <Input id="card-cost" type="number" min="0" step="0.01" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} />
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="card-worker">{t('caseView.cardWorkerLabel', 'Worker Name / Sign')}</Label>
              <Input id="card-worker" value={form.workerNameSign} onChange={e => setForm({ ...form, workerNameSign: e.target.value })} />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" size="sm">{t('caseView.cancel', 'Cancel')}</Button>
              </DialogClose>
              <Button size="sm" type="submit" disabled={saving}>
                {saving ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
                {t('caseView.cardLog', 'Log Entry')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}