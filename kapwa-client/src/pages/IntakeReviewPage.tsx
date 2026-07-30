import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { toast } from 'sonner';

interface MatchCandidate {
  householdId: string;
  score: number;
  caseExistsWithin30Days: boolean;
  primaryBeneficiary: {
    id: string; surname: string; firstName: string; middleName?: string;
    gender: string; age: number; phone: string; occupation: string;
    estimatedMonthlyIncome: number; civilStatus: string;
    currentAddress: Record<string, string> | null;
    philhealthNumber?: string; category?: string;
  };
  allBeneficiaries: Array<{ id: string; surname: string; firstName: string }>;
  familyMembers: Array<{ id: string; fullName: string; relationship: string; age: number; occupation: string; income: number; status: string }>;
  lastApprovedCaseDate: string | null;
}

interface LocationState {
  candidates: MatchCandidate[];
  intakeData: any;
}

function confidenceLabel(score: number): { label: string; className: string } {
  if (score >= 0.8) return { label: 'Very likely the same person', className: 'bg-green-100 text-green-800 border-green-300' };
  if (score >= 0.5) return { label: 'Some similarities', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
  return { label: 'Same surname only', className: 'bg-gray-100 text-gray-600 border-gray-300' };
}

function eligibilityNote(candidate: MatchCandidate): { text: string; icon: 'check' | 'info' } {
  if (candidate.caseExistsWithin30Days) {
    return { text: 'Has an active case — info will be updated, no new case will be created.', icon: 'info' };
  }
  if (candidate.lastApprovedCaseDate) {
    const d = new Date(candidate.lastApprovedCaseDate);
    return { text: `Last case: ${d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })} — eligible for a new case.`, icon: 'check' };
  }
  return { text: 'No prior case on record — a new case will be created.', icon: 'check' };
}

function MatchRow({ label, newVal, existingVal }: { label: string; newVal: string; existingVal: string }) {
  const match = newVal.toLowerCase() === existingVal.toLowerCase();
  return (
    <div className="grid grid-cols-[1fr_auto_1fr_24px] gap-2 items-center text-sm py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-right text-muted-foreground">{newVal || '—'}</span>
      <span className="text-xs text-muted-foreground mx-2">{label}</span>
      <span className="text-left font-medium">{existingVal || '—'}</span>
      <span className={match ? 'text-green-600' : 'text-gray-300'}>{match ? '✅' : '○'}</span>
    </div>
  );
}

function formatIntakeField(beneficiary: Record<string, any>, field: string): string {
  if (field === 'age') return String(beneficiary.age || '');
  if (field === 'barangay') return beneficiary.currentAddress?.barangay || '';
  if (field === 'estimatedMonthlyIncome') return `₱${(beneficiary.estimatedMonthlyIncome || 0).toLocaleString()}`;
  return String(beneficiary[field] || '');
}

export function IntakeReviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  if (!state || !state.candidates) {
    return (
      <PageShell title="Match Review" description="No intake data found">
        <div className="text-center py-12 text-muted-foreground">
          No intake data to review. <Button variant="link" onClick={() => navigate('/intake')}>Go back to intake form</Button>
        </div>
      </PageShell>
    );
  }

  const { candidates, intakeData } = state;
  const intake = (intakeData as any)?.beneficiary || {};
  const family = (intakeData as any)?.familyMembers || [];

  const sorted = [...candidates].sort((a, b) => b.score - a.score);

  async function handleConfirm(householdId: string) {
    setLoadingId(householdId);
    try {
      const result = await api.post<{ caseCreated: boolean; caseId?: string; message: string }>(
        `/intake/confirm/${householdId}`,
        intakeData,
      );
      if (result.caseCreated) {
        toast.success('Client registered', { description: result.message });
        navigate(`/cases/${result.caseId}`);
      } else {
        toast.info('Info updated', { description: result.message });
        navigate(`/cases`);
      }
    } catch {
      toast.error('Failed to update', { description: 'Please try again.' });
    } finally {
      setLoadingId(null);
    }
  }

  async function handleCreateNew() {
    setCreatingNew(true);
    try {
      const result = await api.post<{ caseId: string; controlNo: string }>('/intake', intakeData);
      navigate(`/cases/${result.caseId}`);
    } catch {
      toast.error('Failed to create client', { description: 'Please check your input and try again.' });
    } finally {
      setCreatingNew(false);
    }
  }

  return (
    <PageShell
      title="Check for Prior Records"
      description="We found records that may belong to this client."
    >
      {sorted.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          <AlertTriangle size={32} className="mx-auto mb-2 opacity-40" />
          <p>No prior records found for this name.</p>
          <Button variant="default" className="mt-4" onClick={handleCreateNew} disabled={creatingNew}>
            {creatingNew ? 'Creating...' : 'Continue as new client'}
          </Button>
        </Card>
      )}

      <div className="space-y-6">
        {sorted.map((c) => {
          const cLabel = confidenceLabel(c.score);
          const elig = eligibilityNote(c);
          return (
            <Card key={c.householdId} className="overflow-hidden" data-testid="match-card">
              <div className={`px-4 py-2 border-b text-sm font-medium ${cLabel.className}`}>
                {cLabel.label}
              </div>

              <div className="p-4 space-y-3">
                <p className="text-base font-semibold">
                  Is this <span className="text-primary">{c.primaryBeneficiary.firstName} {c.primaryBeneficiary.surname}</span>?
                </p>

                <div className="bg-gray-50 rounded-lg p-4 space-y-1">
                  <div className="grid grid-cols-[1fr_auto_1fr_24px] gap-2 text-xs text-muted-foreground pb-1 border-b border-gray-200 mb-1">
                    <span className="text-right">You entered</span>
                    <span />
                    <span>Existing record</span>
                    <span />
                  </div>

                  <MatchRow label="Name" newVal={`${intake.surname}, ${intake.firstName}`} existingVal={`${c.primaryBeneficiary.surname}, ${c.primaryBeneficiary.firstName}`} />
                  <MatchRow label="Age" newVal={formatIntakeField(intake, 'age')} existingVal={String(c.primaryBeneficiary.age)} />
                  <MatchRow label="Barangay" newVal={formatIntakeField(intake, 'barangay')} existingVal={c.primaryBeneficiary.currentAddress?.barangay || ''} />
                  {c.primaryBeneficiary.philhealthNumber && (
                    <MatchRow label="PhilHealth" newVal={formatIntakeField(intake, 'philhealthNumber')} existingVal={c.primaryBeneficiary.philhealthNumber} />
                  )}
                </div>

                <div className={`flex items-start gap-2 text-sm p-3 rounded-lg ${elig.icon === 'info' ? 'bg-blue-50 text-blue-800' : 'bg-green-50 text-green-800'}`}>
                  {elig.icon === 'info' ? <Info size={16} className="mt-0.5 shrink-0" /> : <CheckCircle size={16} className="mt-0.5 shrink-0" />}
                  <span>{elig.text}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleConfirm(c.householdId)}
                    disabled={loadingId === c.householdId}
                  >
                    {loadingId === c.householdId
                      ? 'Updating...'
                      : c.caseExistsWithin30Days
                        ? `Yes, update info`
                        : `Yes, update info & create case`}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      toast('Marked as different. You can choose another match or create a new record below.');
                    }}
                  >
                    No, different person
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}

        <Separator className="my-2" />

        <div className="text-center space-y-2 py-4">
          <p className="text-sm text-muted-foreground">
            None of these match your client?
          </p>
          <Button
            variant="outline"
            onClick={handleCreateNew}
            disabled={creatingNew}
          >
            {creatingNew ? 'Registering...' : 'Register as new client'}
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
