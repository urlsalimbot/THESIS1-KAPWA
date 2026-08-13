import { useState } from 'react';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useSWRConfig } from 'swr';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Calendar, FileText, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface FollowUpVisit {
  date: string;
  type: string;
  notes: string;
  outcome: string;
}

interface StepTransitionProps {
  caseId: string;
  caseData: any;
  userRole?: string;
  readOnly?: boolean;
}

export function StepTransition({ caseId, caseData, userRole, readOnly }: StepTransitionProps) {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const [saving, setSaving] = useState(false);

  const [plan, setPlan] = useState({
    selfRelianceLevel: caseData?.selfRelianceLevel || null,
    sustainabilityPlan: caseData?.sustainabilityPlan || '',
    transitionDate: caseData?.transitionDate || '',
    selfReliancePlan: caseData?.selfReliancePlan || '',
  });

  const [followUps, setFollowUps] = useState<FollowUpVisit[]>(
    (caseData?.followUpVisits || []) as FollowUpVisit[]
  );

  const [newFollowUp, setNewFollowUp] = useState({
    date: '',
    type: '',
    notes: '',
    outcome: '',
  });

  const [addingFollowUp, setAddingFollowUp] = useState(false);

  function addFollowUp() {
    if (!newFollowUp.date || !newFollowUp.type) return;
    setFollowUps(prev => [...prev, { ...newFollowUp }]);
    setNewFollowUp({ date: '', type: '', notes: '', outcome: '' });
    setAddingFollowUp(false);
  }

  function removeFollowUp(index: number) {
    setFollowUps(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/cases/${caseId}/transition-plan`, {
        selfRelianceLevel: plan.selfRelianceLevel,
        sustainabilityPlan: plan.sustainabilityPlan || null,
        transitionDate: plan.transitionDate || null,
        selfReliancePlan: plan.selfReliancePlan || null,
        followUpVisits: followUps.length > 0 ? followUps : null,
      });
      await mutate(queryKeys.cases.detail(caseId));
    } catch (e) {
      console.error('Failed to save transition plan:', e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Self-Reliance Assessment */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{t('caseView.transition.selfRelianceAssessment', 'Self-Reliance Assessment')}</h3>
            {readOnly && <Lock size={14} className="text-muted-foreground" />}
          </div>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('caseView.transition.selfRelianceLevel', 'Self-Reliance Level *')}</label>
            <div className="space-y-2">
              {[
                { value: 1, label: t('caseView.transition.level1', 'Level 1 - Dependent'), description: t('caseView.transition.level1Desc', 'Needs full support and assistance') },
                { value: 2, label: t('caseView.transition.level2', 'Level 2 - Partially Self-Reliant'), description: t('caseView.transition.level2Desc', 'Some support needed, making progress') },
                { value: 3, label: t('caseView.transition.level3', 'Level 3 - Self-Sufficient'), description: t('caseView.transition.level3Desc', 'Ready for graduation, can sustain independently') },
              ].map(option => (
                <label key={option.value} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted cursor-pointer">
                  <input
                    type="radio"
                    name="selfRelianceLevel"
                    value={option.value}
                    checked={plan.selfRelianceLevel === option.value}
                    onChange={() => setPlan(p => ({ ...p, selfRelianceLevel: option.value }))}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sustainability Plan */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{t('caseView.transition.sustainabilityPlan', 'Sustainability Plan')}</h3>
            {readOnly && <Lock size={14} className="text-muted-foreground" />}
          </div>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('caseView.transition.maintainProgress', 'How will the client maintain progress after case closure?')}</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
              value={plan.sustainabilityPlan}
              onChange={e => setPlan(p => ({ ...p, sustainabilityPlan: e.target.value }))}
              placeholder={t('caseView.transition.sustainabilityPlaceholder', "Describe the client's plan for sustaining improvements independently...")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('caseView.transition.selfRelianceSteps', 'Self-Reliance Steps')}</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                value={plan.selfReliancePlan}
                onChange={e => setPlan(p => ({ ...p, selfReliancePlan: e.target.value }))}
                placeholder={t('caseView.transition.selfRelianceStepsPlaceholder', 'Recommendations for skills training, livelihood programs...')}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('caseView.transition.targetTransitionDate', 'Target Transition Date')}</label>
              <Input
                type="date"
                value={plan.transitionDate}
                onChange={e => setPlan(p => ({ ...p, transitionDate: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Follow-up Visits */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t('caseView.transition.followUpVisits', 'Follow-up Visits')}</h3>
          <Button variant="outline" size="sm" onClick={() => setAddingFollowUp(!addingFollowUp)}>
            <Plus size={14} className="mr-1" /> {t('caseView.transition.addVisit', 'Add Visit')}
          </Button>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          {/* Add Visit Form */}
          {addingFollowUp && (
            <div className="grid grid-cols-2 gap-2 text-sm p-2 border rounded-md bg-muted/30">
              <div className="space-y-1">
                <label className="text-xs font-medium">{t('caseView.transition.date', 'Date *')}</label>
                <Input
                  type="date"
                  value={newFollowUp.date}
                  onChange={e => setNewFollowUp(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">{t('caseView.transition.type', 'Type *')}</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newFollowUp.type}
                  onChange={e => setNewFollowUp(f => ({ ...f, type: e.target.value }))}
                >
                  <option value="">—</option>
                  {[
                    { value: 'Home Visit', label: t('caseView.transition.visitType.home', 'Home Visit') },
                    { value: 'Phone Call', label: t('caseView.transition.visitType.phone', 'Phone Call') },
                    { value: 'Office Visit', label: t('caseView.transition.visitType.office', 'Office Visit') },
                    { value: 'Community Visit', label: t('caseView.transition.visitType.community', 'Community Visit') },
                  ].map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-medium">{t('caseView.transition.notes', 'Notes')}</label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                  value={newFollowUp.notes}
                  onChange={e => setNewFollowUp(f => ({ ...f, notes: e.target.value }))}
                  placeholder={t('caseView.transition.notesPlaceholder', 'Visit notes...')}
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-medium">{t('caseView.transition.outcome', 'Outcome')}</label>
                <Input
                  value={newFollowUp.outcome}
                  onChange={e => setNewFollowUp(f => ({ ...f, outcome: e.target.value }))}
                  placeholder={t('caseView.transition.outcomePlaceholder', 'e.g., On track, Needs additional support')}
                />
              </div>
              <div className="col-span-2 flex gap-2">
                <Button size="sm" onClick={addFollowUp} disabled={!newFollowUp.date || !newFollowUp.type}>
                  {t('caseView.transition.add', 'Add')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAddingFollowUp(false)}>
                  {t('caseView.cancel', 'Cancel')}
                </Button>
              </div>
            </div>
          )}

          {/* Visit List */}
          {followUps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">
              {t('caseView.transition.noFollowUps', 'No follow-up visits recorded yet.')}
            </p>
          ) : (
            followUps.map((visit, i) => (
              <div key={i} className="flex items-start justify-between p-2 rounded border bg-muted/30">
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-muted-foreground" />
                    <span className="font-medium">
                      {new Date(visit.date).toLocaleDateString()}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span>{visit.type}</span>
                  </div>
                  {visit.notes && (
                    <p className="text-xs text-muted-foreground">{visit.notes}</p>
                  )}
                  {visit.outcome && (
                    <p className="text-xs text-primary">{t('caseView.transition.outcomeLabel', 'Outcome: {{outcome}}', { outcome: visit.outcome })}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => removeFollowUp(i)}
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Save Button */}
      {!readOnly && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('caseView.saving', 'Saving...') : t('caseView.transition.saveTransitionPlan', 'Save Transition Plan')}
          </Button>
        </div>
      )}

      {/* Status transition */}
      {caseData?.status === 'active' && userRole === 'admin' && (
        <div className="rounded-lg border bg-primary/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary">{t('caseView.transition.planReady', 'Transition plan ready')}</p>
              <p className="text-xs text-muted-foreground">{t('caseView.transition.planReadyHint', 'Mark case as transitioning to begin graduation process.')}</p>
            </div>
            <TransitionButton caseId={caseId} mutate={mutate} />
          </div>
        </div>
      )}
    </div>
  );
}

function TransitionButton({ caseId, mutate }: { caseId: string; mutate: any }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  async function handleTransition() {
    setLoading(true);
    try {
      await api.patch(`/cases/${caseId}/disburse`, { status: 'transitioning' });
      await mutate(queryKeys.cases.detail(caseId));
    } catch (e) {
      console.error('Failed to transition:', e);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button onClick={handleTransition} disabled={loading} size="sm">
      {loading ? t('caseView.processing', 'Processing...') : t('caseView.transition.markReady', '→ Mark Ready for Graduation')}
    </Button>
  );
}
