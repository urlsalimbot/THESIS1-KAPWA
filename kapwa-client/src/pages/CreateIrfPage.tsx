import { useState } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Shield, User, Phone, Calendar, Flag } from 'lucide-react';

export function CreateIrfPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const caseId = searchParams.get('caseId');
  const { mutate: globalMutate } = useSWRConfig();
  const [form, setForm] = useState({
    caseCategory: '',
    narration: '',
    reporterName: '',
    reporterContact: '',
    reportedPersonName: '',
    reportedPersonContact: '',
    incidentDate: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // IRFs are only created within a case — a missing caseId means the page
  // was reached without one, so bounce back to the case list.
  if (!caseId) {
    return <Navigate to="/cases" replace />;
  }

  const backToCase = { label: t('cases.viewCase', 'Back to Case'), onClick: () => navigate(`/cases/${caseId}`) };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/irf', {
        caseCategory: form.caseCategory,
        narration: form.narration,
        datetimeIncident: form.incidentDate || undefined,
        caseId,
        itemAReportingPerson: { name: form.reporterName, contact: form.reporterContact },
        itemBPersonReported: form.reportedPersonName
          ? { name: form.reportedPersonName, contact: form.reportedPersonContact || undefined }
          : undefined,
      });
      toast.success(t('irf.created', 'IRF created'), { description: t('irf.createdDesc', 'Incident report has been filed.') });
      globalMutate(queryKeys.irf.list());
      navigate(`/cases/${caseId}`);
    } catch (err) {
      console.error(err);
      toast.error(t('irf.createFailed', 'Failed to create IRF'), { description: t('irf.checkInput', 'Please check your input and try again.') });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell
      title={t('irf.newTitle', 'New Incident Report')}
      description={t('irf.newDescription', 'VAWC / RA 9262 case — MSWDO Norzagaray')}
      backTo={backToCase}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Case Category + Incident Date */}
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-foreground">{t('irf.caseDetails', 'Case Details')}</h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">{t('irf.caseCategory', 'Case Category *')}</label>
                <select
                  value={form.caseCategory}
                  onChange={e => setForm({ ...form, caseCategory: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={t('irf.caseCategory', 'Case Category')}
                  required
                >
                  <option value="">{t('irf.select', 'Select...')}</option>
                  <option value="Abuse">{t('irf.catAbuse', 'Abuse')}</option>
                  <option value="Neglect">{t('irf.catNeglect', 'Neglect')}</option>
                  <option value="Exploitation">{t('irf.catExploitation', 'Exploitation')}</option>
                  <option value="Criminal">{t('irf.catCriminal', 'Criminal')}</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <Calendar size={12} /> {t('irf.dateOfIncident', 'Date of Incident')}
                </label>
                <Input type="date" value={form.incidentDate} onChange={e => setForm({ ...form, incidentDate: e.target.value })} className="h-9" aria-label={t('irf.dateOfIncident', 'Date of Incident')} />
              </div>
            </div>
          </div>
        </div>

        {/* Persons Involved */}
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-foreground">{t('irf.personsInvolved', 'Persons Involved')}</h2>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><User size={12} /> {t('irf.reportingPerson', 'Reporting Person')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('irf.nameRequired', 'Name *')}</label>
                  <Input required value={form.reporterName} onChange={e => setForm({ ...form, reporterName: e.target.value })} className="h-9" aria-label={t('irf.reporterName', 'Reporter Name')} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('irf.contact', 'Contact')}</label>
                  <Input value={form.reporterContact} onChange={e => setForm({ ...form, reporterContact: e.target.value })} className="h-9" aria-label={t('irf.reporterContact', 'Reporter Contact')} />
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Flag size={12} /> {t('irf.personReported', 'Person Reported')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('irf.name', 'Name')}</label>
                  <Input value={form.reportedPersonName} onChange={e => setForm({ ...form, reportedPersonName: e.target.value })} className="h-9" aria-label={t('irf.reportedPersonName', 'Reported Person Name')} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('irf.contact', 'Contact')}</label>
                  <Input value={form.reportedPersonContact} onChange={e => setForm({ ...form, reportedPersonContact: e.target.value })} className="h-9" aria-label={t('irf.reportedPersonContact', 'Reported Person Contact')} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Narration */}
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
            <Shield size={14} className="text-accent" />
            <h2 className="text-sm font-semibold text-foreground">{t('irf.narration', 'Narration')}</h2>
            <span className="text-[11px] text-muted-foreground ml-auto">{t('irf.encrypted', 'AES-256 encrypted at rest')}</span>
          </div>
          <div className="p-4">
            <textarea
              value={form.narration}
              onChange={e => setForm({ ...form, narration: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y min-h-[200px]"
              placeholder={t('irf.narrationPlaceholder', 'Describe the incident in detail. Include date, time, location, persons involved, and the sequence of events.')}
              aria-label={t('irf.narration', 'Narration')}
              required
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button type="submit" disabled={submitting} aria-label={t('irf.createIrf', 'Create IRF')} className="gap-2">
            {submitting ? t('irf.creating', 'Creating...') : t('irf.createIrf', 'Create IRF')}
          </Button>
          <Button variant="outline" onClick={backToCase.onClick}>{t('irf.cancel', 'Cancel')}</Button>
        </div>
      </form>
    </PageShell>
  );
}
