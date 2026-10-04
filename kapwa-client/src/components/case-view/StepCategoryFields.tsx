import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { HeartHandshake, IdCard, Lock, Scale, ShieldCheck } from 'lucide-react';
import { StepLockBar, type StepLock } from './StepLockBar';

/**
 * The four category steps (spec §5): CICL discernment, VAWC protection order,
 * Solo Parent ID, Adoption & Foster Care. Each is a thin form over the case's
 * step fields plus its own seal bar; the server refuses writes for a category
 * whose template lacks the step, and a seal claim requires the step's data.
 * Kept in one file because they share the save-and-seal shape and are small —
 * splitting each into its own module would be five copies of one pattern with
 * nothing but the field names differing.
 */

interface CategoryStepProps {
  caseId: string;
  caseData: any;
  readOnly?: boolean;
  lockReadOnly?: boolean;
  stepLock?: StepLock | null;
}

/**
 * The card every category step titles for itself, in the shape the other steps
 * on this page use: icon and name on one row, the statutory hint beneath it,
 * then a rule and the record itself. The title used to sit in a box of its own
 * above the card, naming a box it was not in. The seal is passed in rather than
 * placed by each step, because it is a statement about the whole step and
 * belongs below the card — not as another row beside the Save button.
 */
function StepShell({
  icon: Icon,
  title,
  hint,
  readOnly,
  saving,
  onSave,
  lock,
  children,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  hint: string;
  readOnly?: boolean;
  saving?: boolean;
  onSave?: () => void;
  lock: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3">
            <div className="flex items-center gap-2">
              <Icon size={16} className="text-primary" />
              {/* `h3`, like every card heading in the case view: one heading level
                  for cards throughout, so heading-by-heading navigation does not
                  drop a level here for no reason. */}
              <h3 className="text-sm font-semibold">{title}</h3>
              {readOnly && <Lock size={14} className="text-muted-foreground" />}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
          <Separator />
          <div className="p-4 space-y-4">
            {children}
            {/* The Save row is the card's last line, and it exists only when
                there is something to save: a sealed card would otherwise end on
                a rule ruling off nothing. */}
            {!readOnly && (
              <>
                <Separator />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={onSave} disabled={saving}>
                    {saving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
        {lock}
      </section>
    </div>
  );
}

// The shared save bar was inlined into each step so the seal bar and the save
// button sit beside each other without an extra abstraction.
export function StepDiscernment({ caseId, caseData, readOnly, lockReadOnly, stepLock }: CategoryStepProps) {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    discernmentAssessedAt: caseData?.discernmentAssessedAt || '',
    discernmentResult: caseData?.discernmentResult || '',
    discernmentNotes: caseData?.discernmentNotes || '',
  });
  async function save() {
    setSaving(true);
    try {
      await api.patch(`/cases/${caseId}/discernment`, {
        discernmentAssessedAt: form.discernmentAssessedAt || null,
        discernmentResult: form.discernmentResult || null,
        discernmentNotes: form.discernmentNotes || null,
      });
      await mutate(queryKeys.cases.detail(caseId));
    } finally {
      setSaving(false);
    }
  }
  const pathway = form.discernmentResult === 'discerned' ? 'diversion' : form.discernmentResult === 'not_discerned' ? 'intervention' : null;
  return (
    <StepShell
      icon={Scale}
      title={t('caseView.discernment.title', 'Discernment Assessment')}
      hint={t('caseView.discernment.hint', 'Under R.A. 9344 §22, the social worker determines whether a CICL above 15 and below 18 acted with discernment — this decides diversion vs intervention program (DSWD AO 10 s. 2007).')}
      readOnly={readOnly}
      saving={saving}
      onSave={save}
      lock={
        <StepLockBar caseId={caseId} stepKey="discernment" caseData={caseData} interventionCount={0} enrollmentCount={0}
          locked={stepLock} readOnly={lockReadOnly} onChanged={async () => mutate(queryKeys.cases.detail(caseId))} />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t('caseView.discernment.assessedAt', 'Assessment Date *')}</span>
          <Input type="date" value={form.discernmentAssessedAt} disabled={readOnly}
            onChange={(e) => setForm((f) => ({ ...f, discernmentAssessedAt: e.target.value }))} />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t('caseView.discernment.result', 'Result *')}</span>
          <Select value={form.discernmentResult || undefined} disabled={readOnly} onValueChange={(v) => setForm((f) => ({ ...f, discernmentResult: v }))}>
            <SelectTrigger><SelectValue placeholder={t('caseView.discernment.resultPlaceholder', 'Select result…')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="discerned">{t('caseView.discernment.discerned', 'Acted with discernment')}</SelectItem>
              <SelectItem value="not_discerned">{t('caseView.discernment.notDiscerned', 'Acted without discernment')}</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>
      {pathway && (
        <p className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-muted-foreground">
          {pathway === 'diversion'
            ? t('caseView.discernment.diversionPath', 'Pathway: diversion program (with discernment).')
            : t('caseView.discernment.interventionPath', 'Pathway: intervention program (without discernment).')}
        </p>
      )}
      <label className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">{t('caseView.discernment.notes', 'Notes')}</span>
        <Textarea rows={3} value={form.discernmentNotes} disabled={readOnly}
          onChange={(e) => setForm((f) => ({ ...f, discernmentNotes: e.target.value }))} />
      </label>
      {readOnly && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock size={12} aria-hidden="true" /> {t('caseView.lock.sealedNotice', 'This step is sealed. Unlock it to make changes, then seal it again.')}</p>}    </StepShell>
  );
}

const PO_TYPES = ['Barangay Protection Order (BPO)', 'Temporary Protection Order (TPO)', 'Permanent Protection Order (PPO)'] as const;
const PO_VALIDITY: Record<string, string> = {
  'Barangay Protection Order (BPO)': '15 days (Punong Barangay, ex parte)',
  'Temporary Protection Order (TPO)': '30 days (court, ex parte)',
  'Permanent Protection Order (PPO)': 'until revoked (court)',
};

export function StepProtectionOrder({ caseId, caseData, readOnly, lockReadOnly, stepLock }: CategoryStepProps) {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    protectionOrderType: caseData?.protectionOrderType || '',
    protectionOrderIssuedAt: caseData?.protectionOrderIssuedAt || '',
    protectionOrderIssuedBy: caseData?.protectionOrderIssuedBy || '',
    protectionOrderNotes: caseData?.protectionOrderNotes || '',
  });
  async function save() {
    setSaving(true);
    try {
      await api.patch(`/cases/${caseId}/protection-order`, {
        protectionOrderType: form.protectionOrderType || null,
        protectionOrderIssuedAt: form.protectionOrderIssuedAt || null,
        protectionOrderIssuedBy: form.protectionOrderIssuedBy || null,
        protectionOrderNotes: form.protectionOrderNotes || null,
      });
      await mutate(queryKeys.cases.detail(caseId));
    } finally {
      setSaving(false);
    }
  }
  return (
    <StepShell
      icon={ShieldCheck}
      title={t('caseView.protectionOrder.title', 'Protection Order')}
      hint={t('caseView.protectionOrder.hint', 'Under R.A. 9262 §8/§14–16 the MSWDO assists the victim-survivor in securing a protection order; the social worker may file (§9).')}
      readOnly={readOnly}
      saving={saving}
      onSave={save}
      lock={
        <StepLockBar caseId={caseId} stepKey="protection_order" caseData={caseData} interventionCount={0} enrollmentCount={0}
          locked={stepLock} readOnly={lockReadOnly} onChanged={async () => mutate(queryKeys.cases.detail(caseId))} />
      }
    >
      <label className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">{t('caseView.protectionOrder.type', 'Order Type *')}</span>
        <Select value={form.protectionOrderType || undefined} disabled={readOnly} onValueChange={(v) => setForm((f) => ({ ...f, protectionOrderType: v }))}>
          <SelectTrigger><SelectValue placeholder={t('caseView.protectionOrder.typePlaceholder', 'Select order type…')} /></SelectTrigger>
          <SelectContent>
            {PO_TYPES.map((type) => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      {form.protectionOrderType && (
        <p className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-muted-foreground">
          {t('caseView.protectionOrder.validity', 'Validity: {{validity}}', { validity: PO_VALIDITY[form.protectionOrderType] ?? '' })}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t('caseView.protectionOrder.issuedAt', 'Issued Date')}</span>
          <Input type="date" value={form.protectionOrderIssuedAt} disabled={readOnly}
            onChange={(e) => setForm((f) => ({ ...f, protectionOrderIssuedAt: e.target.value }))} />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t('caseView.protectionOrder.issuedBy', 'Issued By')}</span>
          <Input value={form.protectionOrderIssuedBy} disabled={readOnly} placeholder={t('caseView.protectionOrder.issuedByPlaceholder', 'Punong Barangay / court')}
            onChange={(e) => setForm((f) => ({ ...f, protectionOrderIssuedBy: e.target.value }))} />
        </label>
      </div>
      <label className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">{t('caseView.protectionOrder.notes', 'Notes')}</span>
        <Textarea rows={3} value={form.protectionOrderNotes} disabled={readOnly}
          onChange={(e) => setForm((f) => ({ ...f, protectionOrderNotes: e.target.value }))} />
      </label>    </StepShell>
  );
}

export function StepSoloParent({ caseId, caseData, readOnly, lockReadOnly, stepLock }: CategoryStepProps) {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    soloParentIdIssuedDate: caseData?.soloParentIdIssuedDate || '',
    soloParentIdNumber: caseData?.soloParentIdNumber || '',
    soloParentNotes: caseData?.soloParentNotes || '',
  });
  async function save() {
    setSaving(true);
    try {
      await api.patch(`/cases/${caseId}/solo-parent`, {
        soloParentIdIssuedDate: form.soloParentIdIssuedDate || null,
        soloParentIdNumber: form.soloParentIdNumber || null,
        soloParentNotes: form.soloParentNotes || null,
      });
      await mutate(queryKeys.cases.detail(caseId));
    } finally {
      setSaving(false);
    }
  }
  return (
    <StepShell
      icon={IdCard}
      title={t('caseView.soloParent.title', 'Solo Parent ID')}
      hint={t('caseView.soloParent.hint', 'Under R.A. 8972 §4 the DSWD worker assesses eligibility against the poverty threshold; the LGU issues the Solo Parent ID (benefits: parental leave, educational, housing).')}
      readOnly={readOnly}
      saving={saving}
      onSave={save}
      lock={
        <StepLockBar caseId={caseId} stepKey="solo_parent" caseData={caseData} interventionCount={0} enrollmentCount={0}
          locked={stepLock} readOnly={lockReadOnly} onChanged={async () => mutate(queryKeys.cases.detail(caseId))} />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t('caseView.soloParent.issuedDate', 'ID Issued Date *')}</span>
          <Input type="date" value={form.soloParentIdIssuedDate} disabled={readOnly}
            onChange={(e) => setForm((f) => ({ ...f, soloParentIdIssuedDate: e.target.value }))} />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t('caseView.soloParent.idNumber', 'ID Number *')}</span>
          <Input value={form.soloParentIdNumber} disabled={readOnly} placeholder="SP-…"
            onChange={(e) => setForm((f) => ({ ...f, soloParentIdNumber: e.target.value }))} />
        </label>
      </div>
      <label className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">{t('caseView.soloParent.notes', 'Notes')}</span>
        <Textarea rows={3} value={form.soloParentNotes} disabled={readOnly}
          onChange={(e) => setForm((f) => ({ ...f, soloParentNotes: e.target.value }))} />
      </label>    </StepShell>
  );
}

export function StepAdoption({ caseId, caseData, readOnly, lockReadOnly, stepLock }: CategoryStepProps) {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    adoptionDvcDate: caseData?.adoptionDvcDate || '',
    adoptionCaseStudyDate: caseData?.adoptionCaseStudyDate || '',
    adoptionCdclaaReceived: caseData?.adoptionCdclaaReceived ?? null,
    adoptionNotes: caseData?.adoptionNotes || '',
  });
  async function save() {
    setSaving(true);
    try {
      await api.patch(`/cases/${caseId}/adoption`, {
        adoptionDvcDate: form.adoptionDvcDate || null,
        adoptionCaseStudyDate: form.adoptionCaseStudyDate || null,
        adoptionCdclaaReceived: form.adoptionCdclaaReceived,
        adoptionNotes: form.adoptionNotes || null,
      });
      await mutate(queryKeys.cases.detail(caseId));
    } finally {
      setSaving(false);
    }
  }
  return (
    <StepShell
      icon={HeartHandshake}
      title={t('caseView.adoption.title', 'Adoption & Foster Care')}
      hint={t('caseView.adoption.hint', 'Under R.A. 11642 the LSWDO files the CDCLAA petition (§12); the DVC, child case-study and home-study reports are the document spine (§11: within 3 months of DVC/foundling certification).')}
      readOnly={readOnly}
      saving={saving}
      onSave={save}
      lock={
        <StepLockBar caseId={caseId} stepKey="adoption" caseData={caseData} interventionCount={0} enrollmentCount={0}
          locked={stepLock} readOnly={lockReadOnly} onChanged={async () => mutate(queryKeys.cases.detail(caseId))} />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t('caseView.adoption.dvcDate', 'DVC Date *')}</span>
          <Input type="date" value={form.adoptionDvcDate} disabled={readOnly}
            onChange={(e) => setForm((f) => ({ ...f, adoptionDvcDate: e.target.value }))} />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t('caseView.adoption.caseStudyDate', 'Child Case Study Date *')}</span>
          <Input type="date" value={form.adoptionCaseStudyDate} disabled={readOnly}
            onChange={(e) => setForm((f) => ({ ...f, adoptionCaseStudyDate: e.target.value }))} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!form.adoptionCdclaaReceived} disabled={readOnly}
          onChange={(e) => setForm((f) => ({ ...f, adoptionCdclaaReceived: e.target.checked }))} />
        {t('caseView.adoption.cdclaaReceived', 'CDCLAA received (petition filed)')}
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">{t('caseView.adoption.notes', 'Notes')}</span>
        <Textarea rows={3} value={form.adoptionNotes} disabled={readOnly}
          onChange={(e) => setForm((f) => ({ ...f, adoptionNotes: e.target.value }))} />
      </label>    </StepShell>
  );
}