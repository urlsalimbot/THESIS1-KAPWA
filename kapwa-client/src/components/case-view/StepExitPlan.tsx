import { useState } from 'react';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useSWRConfig } from 'swr';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, ExternalLink } from 'lucide-react';

interface Referral {
  agencyName: string;
  contactInfo?: string;
  reason: string;
  status: 'pending' | 'completed' | 'declined';
  notes?: string;
}

interface StepExitPlanProps {
  caseId: string;
  caseData: any;
}

export function StepExitPlan({ caseId, caseData }: StepExitPlanProps) {
  const { mutate } = useSWRConfig();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [plan, setPlan] = useState({
    selfReliancePlan: caseData?.selfReliancePlan || '',
    referrals: (caseData?.referrals || []) as Referral[],
    followUpDate: caseData?.followUpDate || '',
    exitNotes: caseData?.exitNotes || '',
  });

  const [newReferral, setNewReferral] = useState({ agencyName: '', contactInfo: '', reason: '', notes: '' });

  function addReferral() {
    if (!newReferral.agencyName) return;
    setPlan(p => ({
      ...p,
      referrals: [...p.referrals, { ...newReferral, status: 'pending' as const }],
    }));
    setNewReferral({ agencyName: '', contactInfo: '', reason: '', notes: '' });
  }

  function removeReferral(index: number) {
    setPlan(p => ({
      ...p,
      referrals: p.referrals.filter((_, i) => i !== index),
    }));
  }

  function updateReferralStatus(index: number, status: 'pending' | 'completed' | 'declined') {
    setPlan(p => ({
      ...p,
      referrals: p.referrals.map((r, i) => i === index ? { ...r, status } : r),
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/cases/${caseId}/transition-plan`, {
        selfReliancePlan: plan.selfReliancePlan || null,
        referrals: plan.referrals.length > 0 ? plan.referrals : null,
        followUpDate: plan.followUpDate || null,
        exitNotes: plan.exitNotes || null,
      });
      await mutate(queryKeys.cases.detail(caseId));
      setEditing(false);
    } catch (e) {
      console.error('Failed to save transition plan:', e);
    } finally {
      setSaving(false);
    }
  }

  const hasData = caseData?.selfReliancePlan || (caseData?.referrals?.length > 0) || caseData?.followUpDate || caseData?.exitNotes;

  return (
    <div className="space-y-4">
      {/* Self-Reliance Plan */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Self-Reliance Plan</h3>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              {hasData ? 'Edit' : 'Add Plan'}
            </Button>
          )}
        </div>
        <Separator />
        <div className="px-4 py-3">
          {editing ? (
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
              value={plan.selfReliancePlan}
              onChange={e => setPlan(p => ({ ...p, selfReliancePlan: e.target.value }))}
              placeholder="Recommendations for self-reliance steps, skills training, livelihood programs..."
            />
          ) : (
            <p className="text-sm">{caseData?.selfReliancePlan || '—'}</p>
          )}
        </div>
      </div>

      {/* Referrals */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Referrals to Other Agencies</h3>
          {editing && (
            <Button variant="outline" size="sm" onClick={() => {
              if (!newReferral.agencyName) return;
              addReferral();
            }}>
              <Plus size={14} className="mr-1" /> Add Referral
            </Button>
          )}
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          {editing && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Input placeholder="Agency name *" value={newReferral.agencyName} onChange={e => setNewReferral(r => ({ ...r, agencyName: e.target.value }))} />
              <Input placeholder="Contact info" value={newReferral.contactInfo} onChange={e => setNewReferral(r => ({ ...r, contactInfo: e.target.value }))} />
              <Input placeholder="Reason for referral" value={newReferral.reason} onChange={e => setNewReferral(r => ({ ...r, reason: e.target.value }))} className="col-span-2" />
            </div>
          )}

          {plan.referrals.length === 0 && !editing ? (
            <p className="text-sm text-muted-foreground text-center py-3">No referrals recorded.</p>
          ) : (
            plan.referrals.map((ref, i) => (
              <div key={i} className="flex items-start justify-between p-2 rounded border bg-muted/30">
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{ref.agencyName}</span>
                    <Badge variant={ref.status === 'completed' ? 'default' : ref.status === 'declined' ? 'destructive' : 'outline'} className="text-[10px]">
                      {ref.status}
                    </Badge>
                  </div>
                  {ref.contactInfo && <p className="text-xs text-muted-foreground">{ref.contactInfo}</p>}
                  {ref.reason && <p className="text-xs text-muted-foreground">{ref.reason}</p>}
                </div>
                {editing && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => updateReferralStatus(i, 'completed')}>✓</Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeReferral(i)}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Follow-up & Exit Notes */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold">Follow-up & Closing Notes</h3>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          {editing ? (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Follow-up Date</label>
                <Input type="date" value={plan.followUpDate} onChange={e => setPlan(p => ({ ...p, followUpDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Exit Notes</label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                  value={plan.exitNotes}
                  onChange={e => setPlan(p => ({ ...p, exitNotes: e.target.value }))}
                  placeholder="Final notes before case closure..."
                />
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Exit Plan'}
              </Button>
            </>
          ) : (
            <>
              <div className="text-sm">
                <span className="text-muted-foreground">Follow-up Date</span>
                <p className="font-medium">{caseData?.followUpDate ? new Date(caseData.followUpDate).toLocaleDateString() : '—'}</p>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Exit Notes</span>
                <p className="font-medium">{caseData?.exitNotes || '—'}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
