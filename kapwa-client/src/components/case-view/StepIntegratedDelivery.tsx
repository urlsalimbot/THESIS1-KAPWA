import { useState } from 'react';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/errors';
import useSWR, { useSWRConfig } from 'swr';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Lock, FileText } from 'lucide-react';
import { downloadEndorsementLetter, downloadEndorsementLetterById } from '@/lib/api';
import { Agency, LEGAL_BASIS_OPTIONS } from '@/components/referrals/referral-utils';
import { useTranslation } from 'react-i18next';

interface StepIntegratedDeliveryProps {
  caseId: string;
  caseData: any;
  userRole?: string;
  readOnly?: boolean;
}

// The referral step has exactly one confirmation: issue the endorsement letter.
// That action records the inter-agency referral server-side and downloads the
// generated letter, so the letter *is* the referral. Once a referral exists the
// same single button re-downloads it.
export function StepIntegratedDelivery({ caseId, readOnly }: StepIntegratedDeliveryProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const [issueOpen, setIssueOpen] = useState(false);
  const [toAgencyId, setToAgencyId] = useState('');
  const [reason, setReason] = useState('');
  const [legalBasisCode, setLegalBasisCode] = useState(LEGAL_BASIS_OPTIONS[0]);
  const [notes, setNotes] = useState('');
  const [issuing, setIssuing] = useState(false);

  const { data: referrals, mutate: revalidate } = useSWR<{ id: string; toAgencyId: string }[]>(
    queryKeys.interAgencyReferrals.byCase(caseId),
  );
  const { data: agencies } = useSWR<Agency[]>(queryKeys.agencies.list());

  const hasReferrals = (referrals || []).length > 0;
  const latestReferralId = referrals?.[0]?.id;

  async function issue(e: React.FormEvent) {
    e.preventDefault();
    if (issuing) return;
    setIssuing(true);
    try {
      await downloadEndorsementLetter(caseId, {
        toAgencyId,
        reason: reason.trim(),
        legalBasisCode,
        notes: notes.trim() || undefined,
      });
      setIssueOpen(false);
      await revalidate();
      await mutate(queryKeys.cases.detail(caseId));
    } catch (err: any) {
      toast.error(t('caseView.integrated.issueFailed', 'Could not issue the endorsement letter'), { description: humanizeError(err) });
    } finally {
      setIssuing(false);
    }
  }

  async function redownload() {
    if (!latestReferralId || issuing) return;
    setIssuing(true);
    try {
      await downloadEndorsementLetterById(latestReferralId);
    } catch (err: any) {
      toast.error(t('caseView.integrated.issueFailed', 'Could not issue the endorsement letter'), { description: humanizeError(err) });
    } finally {
      setIssuing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-primary" />
            <h3 className="text-sm font-semibold">{t('caseView.integrated.interAgencyReferrals', 'Inter-Agency Referrals')}</h3>
            {readOnly && <Lock size={14} className="text-muted-foreground" />}
          </div>
        </div>
        <div className="border-t px-4 py-4 flex items-center justify-center">
          {readOnly ? (
            <p className="text-xs text-muted-foreground">
              {hasReferrals
                ? t('caseView.integrated.issuedHint', 'Endorsement letter issued for this case.')
                : t('caseView.integrated.noReferralsHint', 'No endorsement letter issued.')}
            </p>
          ) : (
            <Button
              size="sm"
              onClick={hasReferrals ? redownload : () => setIssueOpen(true)}
              disabled={issuing}
              aria-label={hasReferrals ? t('caseView.integrated.endorsementLetter', 'Endorsement Letter') : undefined}
            >
              <FileText size={14} className="mr-1" />
              {issuing
                ? t('caseView.integrated.issuing', 'Issuing...')
                : hasReferrals
                ? t('caseView.integrated.endorsementLetter', 'Endorsement Letter')
                : t('caseView.integrated.issueEndorsementLetter', 'Issue Endorsement Letter')}
            </Button>
          )}
        </div>
      </div>

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('caseView.integrated.issueTitle', 'Issue Endorsement Letter')}</DialogTitle>
            <DialogDescription>
              {t('caseView.integrated.issueDesc', 'This records the inter-agency referral and generates the endorsement letter for the receiving agency.')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={issue} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="endorse-agency" className="text-xs font-medium text-muted-foreground">
                {t('caseView.integrated.targetAgency', 'Target Agency *')}
              </label>
              <select
                id="endorse-agency"
                required
                value={toAgencyId}
                onChange={(e) => setToAgencyId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">{t('caseView.integrated.selectAgency', 'Select agency...')}</option>
                {(agencies || []).map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="endorse-reason" className="text-xs font-medium text-muted-foreground">
                {t('caseView.integrated.reason', 'Reason *')}
              </label>
              <textarea
                id="endorse-reason"
                required
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="endorse-legal" className="text-xs font-medium text-muted-foreground">
                {t('caseView.integrated.legalBasis', 'Legal Basis *')}
              </label>
              <select
                id="endorse-legal"
                required
                value={legalBasisCode}
                onChange={(e) => setLegalBasisCode(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {LEGAL_BASIS_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="endorse-notes" className="text-xs font-medium text-muted-foreground">
                {t('caseView.integrated.notes', 'Notes (optional)')}
              </label>
              <textarea
                id="endorse-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setIssueOpen(false)}>
                {t('caseView.cancel', 'Cancel')}
              </Button>
              <Button type="submit" size="sm" disabled={issuing || !toAgencyId || !reason.trim()}>
                {issuing ? t('caseView.integrated.issuing', 'Issuing...') : t('caseView.integrated.issue', 'Issue')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}