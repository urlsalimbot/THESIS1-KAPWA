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

interface StepIntegratedDeliveryProps {
  caseId: string;
  caseData: any;
}

export function StepIntegratedDelivery({ caseId, caseData }: StepIntegratedDeliveryProps) {
  const { mutate } = useSWRConfig();
  const [saving, setSaving] = useState(false);

  const [referrals, setReferrals] = useState<Referral[]>(
    (caseData?.referrals || []) as Referral[]
  );

  const [newReferral, setNewReferral] = useState({
    agencyName: '',
    contactInfo: '',
    reason: '',
    notes: '',
  });

  function addReferral() {
    if (!newReferral.agencyName) return;
    setReferrals(prev => [
      ...prev,
      { ...newReferral, status: 'pending' as const },
    ]);
    setNewReferral({ agencyName: '', contactInfo: '', reason: '', notes: '' });
  }

  function removeReferral(index: number) {
    setReferrals(prev => prev.filter((_, i) => i !== index));
  }

  function updateReferralStatus(index: number, status: 'pending' | 'completed' | 'declined') {
    setReferrals(prev =>
      prev.map((r, i) => (i === index ? { ...r, status } : r))
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/cases/${caseId}/transition-plan`, {
        referrals: referrals.length > 0 ? referrals : null,
      });
      await mutate(queryKeys.cases.detail(caseId));
    } catch (e) {
      console.error('Failed to save referrals:', e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Referrals */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Referrals to Other Agencies (Optional)</h3>
          <Button variant="outline" size="sm" onClick={addReferral} disabled={!newReferral.agencyName}>
            <Plus size={14} className="mr-1" /> Add Referral (Optional)
          </Button>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          {/* Add Referral Form */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Input
              placeholder="Agency name *"
              value={newReferral.agencyName}
              onChange={e => setNewReferral(r => ({ ...r, agencyName: e.target.value }))}
            />
            <Input
              placeholder="Contact info"
              value={newReferral.contactInfo}
              onChange={e => setNewReferral(r => ({ ...r, contactInfo: e.target.value }))}
            />
            <Input
              placeholder="Reason for referral"
              value={newReferral.reason}
              onChange={e => setNewReferral(r => ({ ...r, reason: e.target.value }))}
              className="col-span-2"
            />
          </div>

          {/* Referral List */}
          {referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">
              No referrals recorded. Referrals are optional — cases can proceed with direct services provided by the MSWDO.
            </p>
          ) : (
            referrals.map((ref, i) => (
              <div key={i} className="flex items-start justify-between p-2 rounded border bg-muted/30">
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{ref.agencyName}</span>
                    <Badge
                      variant={
                        ref.status === 'completed'
                          ? 'default'
                          : ref.status === 'declined'
                          ? 'destructive'
                          : 'outline'
                      }
                      className="text-[10px]"
                    >
                      {ref.status}
                    </Badge>
                  </div>
                  {ref.contactInfo && (
                    <p className="text-xs text-muted-foreground">{ref.contactInfo}</p>
                  )}
                  {ref.reason && (
                    <p className="text-xs text-muted-foreground">{ref.reason}</p>
                  )}
                  {ref.notes && (
                    <p className="text-xs text-muted-foreground/70 italic">{ref.notes}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  {ref.status === 'pending' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => updateReferralStatus(i, 'completed')}
                    >
                      ✓ Complete
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => removeReferral(i)}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Service Delivery'}
        </Button>
      </div>
    </div>
  );
}
