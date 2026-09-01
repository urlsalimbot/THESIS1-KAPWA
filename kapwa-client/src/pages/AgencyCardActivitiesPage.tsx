import { useState } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { useAuth } from '../lib/auth-context';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Search } from 'lucide-react';

interface ServiceEntry {
  id: string;
  accessCardCode: string;
  serviceDate: string;
  serviceRendered: string;
  category: string;
  cost?: number;
  agency?: string;
  workerNameSign?: string;
}

export function AgencyCardActivitiesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [services, setServices] = useState<ServiceEntry[] | null>(null);
  const [personName, setPersonName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: agencies } = useSWR<{ id: string; code: string; name: string }[]>(queryKeys.agencies.list());

  const [category, setCategory] = useState('community_service');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [agencyId, setAgencyId] = useState(user?.agencyId || '');
  const [submitting, setSubmitting] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setServices(null);
    try {
      const result: any = await api.get(`/access-cards/${code.trim()}`);
      setServices(result);
      try {
        const summary: any = await api.get(`/access-cards/${code.trim()}/summary`);
        if (summary?.person) setPersonName(`${summary.person.firstName} ${summary.person.surname}`);
      } catch {}
    } catch {
      setError(t('agency.cardNotFound', 'Access card not found'));
    }
    setLoading(false);
  }

  async function handleLog(e: React.FormEvent) {
    e.preventDefault();
    if (!remarks.trim() || !agencyId) return;
    setSubmitting(true);
    try {
      await api.post('/access-cards/log', {
        accessCardCode: code.trim(),
        serviceRendered: remarks,
        serviceDate,
        category,
        agencyId,
      });
      setRemarks('');
      const result: any = await api.get(`/access-cards/${code.trim()}`);
      setServices(result);
    } catch (err: any) {
      setError(err?.message || t('agency.logFailed', 'Failed to log activity'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell title={t('agency.cardActivities', 'Card Activities')} description={t('agency.verifyAndLog', 'Verify cards and log activities')}>
      <form onSubmit={handleVerify} className="flex gap-2 mb-4">
        <input
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder={t('agency.enterCardCode', 'Enter card code (e.g. NORZ-AC-2026-0001)')}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          aria-label={t('agency.enterCardCode', 'Enter card code')}
        />
        <Button type="submit" disabled={loading || !code.trim()}>
          <Search size={14} className="mr-1" /> {loading ? t('agency.checking', 'Checking...') : t('agency.verify', 'Verify')}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive mb-3">{error}</p>}

      {services && (
        <>
          {personName && <p className="text-sm font-semibold mb-2">{personName}</p>}
          <div className="rounded-lg bg-card p-4 shadow-sm border border-border mb-4">
            <h3 className="text-sm font-semibold mb-2">{t('agency.serviceHistory', 'Service History ({{count}})', { count: services.length })}</h3>
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('agency.noServices', 'No services logged yet.')}</p>
            ) : (
              <div className="divide-y">
                {services.map((s: ServiceEntry) => (
                  <div key={s.id} className="py-2 flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">{s.serviceRendered}</p>
                      <p className="text-xs text-muted-foreground">
                        <Badge variant="secondary" className="text-[10px] mr-1">{s.category}</Badge>
                        {new Date(s.serviceDate).toLocaleDateString()}
                      </p>
                    </div>
                    {s.cost != null && Number(s.cost) > 0 && (
                      <span className="text-sm font-medium tabular-nums">₱{Number(s.cost).toLocaleString()}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleLog} className="rounded-lg bg-card p-4 shadow-sm border border-border space-y-3">
            <h3 className="text-sm font-semibold">{t('agency.logActivity', 'Log Activity')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">{t('agency.category', 'Category *')}</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                >
                  <option value="community_service">{t('agency.catCommunity', 'Community Service')}</option>
                  <option value="seminar">{t('agency.catSeminar', 'Seminar')}</option>
                  <option value="distribution">{t('agency.catDistribution', 'Distribution')}</option>
                  <option value="referral">{t('agency.catReferral', 'Referral')}</option>
                  <option value="case_service">{t('agency.catCaseService', 'Case Service')}</option>
                  <option value="other">{t('agency.catOther', 'Other')}</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">{t('agency.date', 'Date *')}</label>
                <input
                  type="date"
                  value={serviceDate}
                  onChange={e => setServiceDate(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('agency.agency', 'Agency *')}</label>
              <select
                value={agencyId}
                onChange={e => setAgencyId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                required
              >
                <option value="">{t('agency.selectAgency', 'Select agency...')}</option>
                {(agencies || []).map(a => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('agency.remarks', 'Remarks *')}</label>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                rows={2}
                required
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                placeholder={t('agency.remarksPlaceholder', 'Describe the activity...')}
              />
            </div>
            <Button type="submit" size="sm" disabled={submitting || !remarks.trim() || !agencyId}>
              <Check size={14} className="mr-1" /> {submitting ? t('agency.logging', 'Logging...') : t('agency.logActivity', 'Log Activity')}
            </Button>
          </form>
        </>
      )}
    </PageShell>
  );
}
