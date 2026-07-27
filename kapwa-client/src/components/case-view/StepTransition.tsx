import { useState } from 'react';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useSWRConfig } from 'swr';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Calendar, FileText } from 'lucide-react';

interface FollowUpVisit {
  date: string;
  type: string;
  notes: string;
  outcome: string;
}

interface StepTransitionProps {
  caseId: string;
  caseData: any;
}

export function StepTransition({ caseId, caseData }: StepTransitionProps) {
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
          <h3 className="text-sm font-semibold">Self-Reliance Assessment</h3>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Self-Reliance Level *</label>
            <div className="space-y-2">
              {[
                { value: 1, label: 'Level 1 - Dependent', description: 'Needs full support and assistance' },
                { value: 2, label: 'Level 2 - Partially Self-Reliant', description: 'Some support needed, making progress' },
                { value: 3, label: 'Level 3 - Self-Sufficient', description: 'Ready for graduation, can sustain independently' },
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
          <h3 className="text-sm font-semibold">Sustainability Plan</h3>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">How will the client maintain progress after case closure?</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
              value={plan.sustainabilityPlan}
              onChange={e => setPlan(p => ({ ...p, sustainabilityPlan: e.target.value }))}
              placeholder="Describe the client's plan for sustaining improvements independently..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Self-Reliance Steps</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                value={plan.selfReliancePlan}
                onChange={e => setPlan(p => ({ ...p, selfReliancePlan: e.target.value }))}
                placeholder="Recommendations for skills training, livelihood programs..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Target Transition Date</label>
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
          <h3 className="text-sm font-semibold">Follow-up Visits</h3>
          <Button variant="outline" size="sm" onClick={() => setAddingFollowUp(!addingFollowUp)}>
            <Plus size={14} className="mr-1" /> Add Visit
          </Button>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          {/* Add Visit Form */}
          {addingFollowUp && (
            <div className="grid grid-cols-2 gap-2 text-sm p-2 border rounded-md bg-muted/30">
              <div className="space-y-1">
                <label className="text-xs font-medium">Date *</label>
                <Input
                  type="date"
                  value={newFollowUp.date}
                  onChange={e => setNewFollowUp(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Type *</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newFollowUp.type}
                  onChange={e => setNewFollowUp(f => ({ ...f, type: e.target.value }))}
                >
                  <option value="">—</option>
                  <option value="Home Visit">Home Visit</option>
                  <option value="Phone Call">Phone Call</option>
                  <option value="Office Visit">Office Visit</option>
                  <option value="Community Visit">Community Visit</option>
                </select>
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-medium">Notes</label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                  value={newFollowUp.notes}
                  onChange={e => setNewFollowUp(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Visit notes..."
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-medium">Outcome</label>
                <Input
                  value={newFollowUp.outcome}
                  onChange={e => setNewFollowUp(f => ({ ...f, outcome: e.target.value }))}
                  placeholder="e.g., On track, Needs additional support"
                />
              </div>
              <div className="col-span-2 flex gap-2">
                <Button size="sm" onClick={addFollowUp} disabled={!newFollowUp.date || !newFollowUp.type}>
                  Add
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAddingFollowUp(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Visit List */}
          {followUps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">
              No follow-up visits recorded yet.
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
                    <p className="text-xs text-primary">Outcome: {visit.outcome}</p>
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
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Transition Plan'}
        </Button>
      </div>
    </div>
  );
}
