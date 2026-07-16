import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface MatchCandidate {
  householdId: string;
  score: number;
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
  intakeData: unknown;
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-orange-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold tabular-nums w-10 text-right">{pct}%</span>
    </div>
  );
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

  async function handleLink(householdId: string) {
    setLoadingId(householdId);
    try {
      const result = await api.post<{ caseId: string; controlNo: string; nextEligibleDate: string }>(
        `/intake/confirm/${householdId}`,
        intakeData,
      );
      toast.success(`Linked to existing household. Next case eligible: ${new Date(result.nextEligibleDate).toLocaleDateString()}`);
      navigate(`/cases/${result.caseId}`);
    } catch {
      toast.error('Failed to link to household. Please try again.');
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
      toast.error('Failed to create new client record.');
    } finally {
      setCreatingNew(false);
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return 'None';
    return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function nextEligibleDate(lastCaseDate: string | null) {
    if (!lastCaseDate) return 'Now';
    const d = new Date(lastCaseDate);
    d.setDate(d.getDate() + 30);
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  return (
    <PageShell
      title="Potential Prior Record Match Review"
      description="Review potential household matches before creating a new record."
    >
      <div className="flex gap-6">
        {/* LEFT: Current Intake Summary */}
        <div className="w-80 shrink-0 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Current Intake</h2>
          <Card className="p-4 space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="font-medium">{intake.surname}, {intake.firstName} {intake.middleName || ''}</p>
            </div>
            {intake.currentAddress && (
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p>{intake.currentAddress.street || ''}, {intake.currentAddress.barangay || ''}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Demographics</p>
              <p>{intake.gender} · {intake.age || ''} yrs · {intake.civilStatus || ''}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Contact</p>
              <p>{intake.cellularNumber || ''}</p>
            </div>
            {family.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">Family Members</p>
                <ul className="list-disc list-inside text-xs">
                  {family.map((f: any, i: number) => (
                    <li key={i}>{f.fullName} ({f.relationship})</li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Income</p>
              <p>₱{(intake.estimatedMonthlyIncome || 0).toLocaleString()}/mo</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Occupation</p>
              <p>{intake.occupation || ''}</p>
            </div>
          </Card>
        </div>

        {/* RIGHT: Potential Matches */}
        <div className="flex-1 space-y-4 min-w-0">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Potential Matches ({candidates.length})
          </h2>

          {candidates.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              <AlertTriangle size={32} className="mx-auto mb-2 opacity-40" />
              <p>No prior records found for this name.</p>
            </Card>
          )}

          {candidates.map((c, i) => (
            <MatchCard
              key={c.householdId}
              candidate={c}
              index={i}
              loading={loadingId === c.householdId}
              onLink={() => handleLink(c.householdId)}
            />
          ))}

          <Separator className="my-4" />

          <div className="text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              If none of these match your client, create a new record.
            </p>
            <Button
              variant="outline"
              onClick={handleCreateNew}
              disabled={creatingNew}
            >
              {creatingNew ? 'Creating...' : 'Create New Client'}
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function MatchCard({ candidate: c, index, loading, onLink }: {
  candidate: MatchCandidate;
  index: number;
  loading: boolean;
  onLink: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden">
      {/* Header (collapsed view) */}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Match #{index + 1}</span>
          <ScoreBar score={c.score} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{c.primaryBeneficiary.surname}, {c.primaryBeneficiary.firstName}</p>
            <p className="text-sm text-muted-foreground">
              {c.primaryBeneficiary.gender} · {c.primaryBeneficiary.age} yrs · {c.primaryBeneficiary.currentAddress?.barangay || ''}
            </p>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={onLink}
            disabled={loading}
          >
            {loading ? 'Linking...' : 'Link to This Household'}
          </Button>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>Members: {c.familyMembers.length}</span>
          {c.lastApprovedCaseDate && (
            <>
              <span>Last case: {new Date(c.lastApprovedCaseDate).toLocaleDateString()}</span>
              <span>Next eligible: {new Date(new Date(c.lastApprovedCaseDate).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </>
          )}
        </div>
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Show Less' : 'Show More'}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t px-4 py-3 space-y-3 text-sm bg-muted/20">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p>{c.primaryBeneficiary.phone || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">PhilHealth</p>
              <p>{c.primaryBeneficiary.philhealthNumber || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Civil Status</p>
              <p>{c.primaryBeneficiary.civilStatus || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Occupation</p>
              <p>{c.primaryBeneficiary.occupation || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Monthly Income</p>
              <p>₱{(c.primaryBeneficiary.estimatedMonthlyIncome || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Category</p>
              <p>{c.primaryBeneficiary.category || '—'}</p>
            </div>
          </div>

          {c.primaryBeneficiary.currentAddress && (
            <div>
              <p className="text-xs text-muted-foreground">Full Address</p>
              <p className="text-xs">
                {c.primaryBeneficiary.currentAddress.street || ''}, {c.primaryBeneficiary.currentAddress.barangay || ''}, {c.primaryBeneficiary.currentAddress.city || ''}, {c.primaryBeneficiary.currentAddress.province || ''}
              </p>
            </div>
          )}

          {c.familyMembers.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">All Family Members</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left py-1">Name</th>
                    <th className="text-left py-1">Relationship</th>
                    <th className="text-right py-1">Age</th>
                    <th className="text-left py-1">Occupation</th>
                    <th className="text-right py-1">Income</th>
                    <th className="text-left py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {c.familyMembers.map(fm => (
                    <tr key={fm.id} className="border-b border-muted/30">
                      <td className="py-1">{fm.fullName}</td>
                      <td className="py-1">{fm.relationship}</td>
                      <td className="py-1 text-right">{fm.age}</td>
                      <td className="py-1">{fm.occupation || '—'}</td>
                      <td className="py-1 text-right">{fm.income ? `₱${fm.income}` : '—'}</td>
                      <td className="py-1">{fm.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {c.allBeneficiaries.length > 1 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Other Beneficiaries in Household</p>
              <div className="flex flex-wrap gap-2">
                {c.allBeneficiaries.filter(b => b.id !== c.primaryBeneficiary.id).map(b => (
                  <span key={b.id} className="text-xs bg-muted px-2 py-1 rounded">{b.surname}, {b.firstName}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
