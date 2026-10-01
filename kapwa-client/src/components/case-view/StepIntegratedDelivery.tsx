import { useState } from 'react';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/errors';
import useSWR, { useSWRConfig } from 'swr';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Lock, FileText, Plus, Ban, CheckCircle2 } from 'lucide-react';
import { api, downloadEndorsementLetter, downloadEndorsementLetterById } from '@/lib/api';
import { Agency, LEGAL_BASIS_OPTIONS } from '@/components/referrals/referral-utils';
import { StepLockBar, type StepLock } from './StepLockBar';
import { useTranslation } from 'react-i18next';

interface StepIntegratedDeliveryProps {
  caseId: string;
  caseData: any;
  userRole?: string;
  readOnly?: boolean;
  /** This step's own seal row, or null — the case view resolves it. */
  stepLock?: StepLock | null;
  /**
   * Whether this step may still be sealed/released, kept apart from the
   * actions' `readOnly`: a sealed step's fields are read-only *because* of the
   * seal, so folding that into the same flag would hide the one control that
   * lifts it. Defaults to `false`, so omitting it can never hide a sealed step's
   * Unlock; a caller that wants the seal control withheld passes `true`.
   */
  lockReadOnly?: boolean;
}

// Step 3 offers the same two mutually exclusive completions as step 2: refer
// the client to an agency, or record that no referral is needed. Issuing the
// endorsement letter is the referral — that one action records it server-side
// and downloads the generated letter — so "Add Referral" opens that dialog.
// Until a client UI existed for `PATCH /cases/:id/referral-decision`, the
// server's `in_review -> active` gate could reject a case for a missing
// referral decision that no one had any way of recording.
export function StepIntegratedDelivery({ caseId, caseData, userRole, readOnly, lockReadOnly = false, stepLock }: StepIntegratedDeliveryProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const [issueOpen, setIssueOpen] = useState(false);
  const [toAgencyId, setToAgencyId] = useState('');
  const [reason, setReason] = useState('');
  const [legalBasisCode, setLegalBasisCode] = useState(LEGAL_BASIS_OPTIONS[0]);
  const [notes, setNotes] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [savingDecision, setSavingDecision] = useState(false);

  const { data: referrals, mutate: revalidate } = useSWR<{ id: string; toAgencyId: string }[]>(
    queryKeys.interAgencyReferrals.byCase(caseId),
  );
  const { data: agencies } = useSWR<Agency[]>(queryKeys.agencies.list());

  const hasReferrals = (referrals || []).length > 0;
  const latestReferralId = referrals?.[0]?.id;
  const referralNotNeeded = Boolean(caseData?.referralNotNeeded);
  const canDecide = userRole === 'admin' || userRole === 'social_worker';

  async function saveDecision(notNeeded: boolean) {
    setSavingDecision(true);
    try {
      await api.patch(`/cases/${caseId}/referral-decision`, { notNeeded });
      await mutate(queryKeys.cases.detail(caseId));
      await mutate(queryKeys.cases.list());
    } catch (err: any) {
      toast.error(t('caseView.integrated.decisionFailed', 'Could not save the referral decision'), { description: humanizeError(err) });
    } finally {
      setSavingDecision(false);
    }
  }

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
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-primary" />
            <h3 className="text-sm font-semibold">{t('caseView.integrated.interAgencyReferrals', 'Inter-Agency Referrals')}</h3>
            {referralNotNeeded && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <CheckCircle2 size={10} /> {t('caseView.integrated.referralNotNeededBadge', 'No referral needed')}
              </Badge>
            )}
            {readOnly && <Lock size={14} className="text-muted-foreground" />}
          </div>
          {/* Once a referral is on record the only remaining action is
              re-downloading the letter, which the body below owns — a second
              "Add Referral" would silently orphan the first referral. */}
          {!readOnly && !(hasReferrals && !referralNotNeeded) && (
            <div className="flex flex-wrap gap-2">
              {referralNotNeeded ? (
                <Button variant="outline" size="sm" disabled={savingDecision} onClick={() => saveDecision(false)}>
                  {t('caseView.integrated.undoReferralNotNeeded', 'Undo decision')}
                </Button>
              ) : (
                <>
                  <Button size="sm" onClick={() => setIssueOpen(true)}>
                    <Plus size={14} className="mr-1" /> {t('caseView.integrated.addReferral', 'Add Referral')}
                  </Button>
                  {/* Mutually exclusive with a live referral: the activation gate
                      rejects a case that is flagged referral-only *and* already
                      carries one. */}
                  {canDecide && (
                    <Button variant="secondary" size="sm" disabled={savingDecision} onClick={() => saveDecision(true)}>
                      <Ban size={14} className="mr-1" /> {t('caseView.integrated.markReferralNotNeeded', 'No Referrals issued')}
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        <div className="border-t px-4 py-4 flex items-center justify-center">
          {hasReferrals ? (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                {t('caseView.integrated.issuedHint', 'Endorsement letter issued for this case.')}
              </p>
              {!readOnly && (
                <Button className="mt-2" size="sm" onClick={redownload} disabled={issuing}>
                  <FileText size={14} className="mr-1" />
                  {issuing
                    ? t('caseView.integrated.issuing', 'Issuing...')
                    : t('caseView.integrated.endorsementLetter', 'Endorsement Letter')}
                </Button>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {referralNotNeeded
                ? t('caseView.integrated.referralNotNeededActive', 'No referral will be issued for this case; the intervention covers the service.')
                : readOnly
                ? t('caseView.integrated.noReferralsHint', 'No endorsement letter issued.')
                : t('caseView.integrated.addReferralHint', 'Refer the client to another agency, or record that no referral is needed.')}
            </p>
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

      {/* Step 3's seal. Only the referral count is passed, and it comes from this
          step's own SWR — so the seal answers exactly the question the list
          above answers, and the case view's stepper (which reads the same SWR)
          cannot disagree with what is on screen. The referral *decision* is on
          the case row and `stepperStepDone` falls back to it, so passing it
          here would restate the rule this step already reads for its own badge
          — and an explicit `false`, which the server coerces and could never
          honour, would outvote the row. */}
      <StepLockBar
        caseId={caseId}
        stepIndex={2}
        caseData={caseData}
        interventionCount={0}
        opts={{ interAgencyReferralCount: hasReferrals ? 1 : 0 }}
        locked={stepLock}
        readOnly={lockReadOnly}
        onChanged={() => mutate(queryKeys.cases.detail(caseId))}
      />
    </div>
  );
}
