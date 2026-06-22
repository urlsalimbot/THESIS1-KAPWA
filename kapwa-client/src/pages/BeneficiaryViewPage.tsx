import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, User, MapPin, Users as UsersIcon, Gift, FileText, Plus,
  ChevronDown, ChevronRight, Shield, ClipboardList
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { getBeneficiary, getCases, getFamilyGraph, createIntervention, uploadSignature, uploadReceipt, dataURItoBlob, getCaseTrackerLog, assignCard } from '../lib/api';
import { FamilyGraph } from '../components/family/FamilyGraph';
import { ConsentManager } from '../components/consent/ConsentManager';
import SignaturePad from '../components/forms/SignaturePad';
import '../index.css';

interface BeneficiaryDetail {
  id: string;
  name: string;
  age: number;
  birthDate: string;
  gender: string;
  contact: string;
  barangay: string;
  purok: string;
  category: string;
  householdSize: number;
  status: string;
  accessCardCode?: string;
  cases: { id: string; program: string; status: string; date: string; amount?: string }[];
  interventions: { id: string; type: string; description: string; date: string; fundSource?: string }[];
}

interface FamilyMember {
  id: string;
  fullName: string;
  relationship: string;
  age: number;
  statusIncome?: string;
  isPrimary: boolean;
}

interface TrackerEntry {
  id: string;
  trackerId?: string;
  dailySeqNum: number;
  interventionRemarks?: string;
}

export function BeneficiaryViewPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [beneficiary, setBeneficiary] = useState<BeneficiaryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [familyExpanded, setFamilyExpanded] = useState(false);
  const [interventionCaseId, setInterventionCaseId] = useState<string | null>(null);
  const [intForm, setIntForm] = useState({ type: 'FA', amount: '', fundSource: 'Regular' });
  const [intSigDataUrl, setIntSigDataUrl] = useState<string | null>(null);
  const [intReceiptFile, setIntReceiptFile] = useState<File | null>(null);
  const [intSubmitting, setIntSubmitting] = useState(false);
  const [intError, setIntError] = useState('');
  const [trackerEntries, setTrackerEntries] = useState<TrackerEntry[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    if (!id) { setLoading(false); return; }
    Promise.all([
      getBeneficiary(id, controller.signal).catch(() => null),
      getCases(undefined, controller.signal).catch(() => []),
      getFamilyGraph(id, controller.signal).catch(() => null),
    ]).then(([ben, cases, famGraph]) => {
      if (ben) {
        const age = ben.dob ? (() => { const today = new Date(); const birth = new Date(ben.dob); let a = today.getFullYear() - birth.getFullYear(); if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) a--; return a; })() : 0;
        const addrParts = (ben.address || '').split(',').map((s: string) => s.trim());
        const beneficiaryCases = (cases || []).filter((c: Record<string, unknown>) => c.beneficiaryId === id || ((c.beneficiary as Record<string, unknown>)?.id as string) === id);
        setBeneficiary({
          id: ben.id,
          name: `${ben.firstName || ''} ${ben.middleName || ''} ${ben.surname || ''}`.replace(/\s+/g, ' ').trim(),
          age,
          birthDate: ben.dob || '',
          gender: ben.gender || '',
          contact: ben.phone || '',
          barangay: addrParts[addrParts.length - 1] || '',
          purok: addrParts.length > 1 ? addrParts[0] : '',
          category: ben.category || '',
          householdSize: famGraph?.totalCount || 1,
          status: ben.consentStatus || 'active',
          accessCardCode: ben.accessCardCode || undefined,
          cases: beneficiaryCases.map((c: Record<string, unknown>) => {
            const sr = c.serviceRequested;
            return {
              id: (c.controlNo || c.id) as string,
              program: Array.isArray(sr) ? sr.join(', ') : 'General',
              status: (c.status as string) || 'pending',
              date: c.createdAt ? new Date(c.createdAt as string).toLocaleDateString() : '',
            };
          }),
          interventions: [],
        });
        if (famGraph?.members) setFamily(famGraph.members);
      }
      setLoading(false);
    });

    // Load tracker entries
    if (id) {
      getCaseTrackerLog().then((entries: TrackerEntry[]) => {
        setTrackerEntries(entries || []);
      }).catch(() => {
        setTrackerEntries([]);
      });
    }
  }, [id]);

  useEffect(() => {
    if (assignSuccess) {
      const t = setTimeout(() => setAssignSuccess(''), 3000);
      return () => clearTimeout(t);
    }
  }, [assignSuccess]);

  const statusBadge = (status: string) => {
    const map: Record<string, { className: string; label: string }> = {
      approved: { className: 'bg-green-100 text-green-800', label: 'Approved' },
      disbursed: { className: 'bg-gray-200 text-gray-700', label: 'Disbursed' },
      pending_assessment: { className: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      active: { className: 'bg-green-100 text-green-800', label: 'Active' },
      closed: { className: 'bg-gray-200 text-gray-700', label: 'Closed' },
    };
    const s = map[status];
    return s ? <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}>{s.label}</span> : <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">{status}</span>;
  };

  async function handleLogIntervention(e: React.FormEvent) {
    e.preventDefault();
    if (!interventionCaseId) return;
    setIntError('');
    setIntSubmitting(true);
    try {
      let workerSignatureUrl = '';
      let receiptUrl = '';

      if (intSigDataUrl) {
        const blob = dataURItoBlob(intSigDataUrl);
        workerSignatureUrl = await uploadSignature(blob, `sig-${Date.now()}.png`);
      }

      if (intReceiptFile) {
        receiptUrl = await uploadReceipt(intReceiptFile, intReceiptFile.name);
      }

      await createIntervention({
        caseId: interventionCaseId,
        interventionType: intForm.type,
        amount: parseFloat(intForm.amount) || 0,
        fundSource: intForm.fundSource,
        workerSignatureUrl: workerSignatureUrl || undefined,
        clientReceiptUrl: receiptUrl || undefined,
      } as any);

      setInterventionCaseId(null);
      setIntForm({ type: 'FA', amount: '', fundSource: 'Regular' });
      setIntSigDataUrl(null);
      setIntReceiptFile(null);
    } catch (err: any) {
      setIntError(err.message || 'Failed to log intervention');
    }
    setIntSubmitting(false);
  }

  async function handleAssignCard() {
    if (!id) return;
    setAssigning(true);
    try {
      const result = await assignCard(id);
      setBeneficiary(prev => prev ? { ...prev, accessCardCode: result.accessCardCode } : prev);
      setAssignSuccess(`Access Card assigned: ${result.accessCardCode}`);
    } catch (err: any) {
      setAssignSuccess('');
    }
    setAssigning(false);
  }

  function handleReprint() {
    if (!beneficiary) return;
    const confirmed = window.confirm(
      `Reprint Access Card for ${beneficiary.name}?\n\n` +
      `Current card code: ${beneficiary.accessCardCode}\n\n` +
      `Verify claimant identity before proceeding.`
    );
    if (!confirmed) return;
    navigate(`/beneficiary/${id}/card/print`);
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;
  if (!beneficiary) return <div className="p-8 text-center text-gray-400">Beneficiary not found</div>;

  const handleConsentChange = useCallback((newStatus: string) => {
    setBeneficiary(prev => prev ? { ...prev, status: newStatus } : prev);
  }, []);

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-[#2E5C8A] hover:underline">
        <ArrowLeft size={16} /> Back
      </button>

      {assignSuccess && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm font-medium text-green-700">
          {assignSuccess}
        </div>
      )}

      <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2E5C8A] text-2xl font-bold text-white">
              {beneficiary.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1A1A1A] font-sans">{beneficiary.name}</h2>
              <p className="text-sm text-gray-500">ID: {beneficiary.id}</p>
              <div className="mt-1 flex items-center gap-3 text-sm text-gray-600">
                <span className="flex items-center gap-1"><User size={14} /> {beneficiary.gender}, {beneficiary.age} yrs old</span>
                <span className="flex items-center gap-1"><MapPin size={14} /> {beneficiary.barangay}{beneficiary.purok ? `, ${beneficiary.purok}` : ''}</span>
              </div>
            </div>
          </div>
          {statusBadge(beneficiary.status)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
          <div className="mb-3 flex items-center gap-2 text-[#2E5C8A]"><UsersIcon size={18} /> <h3 className="text-sm font-semibold">Personal Info</h3></div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Birth Date</span><span>{beneficiary.birthDate}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Contact</span><span>{beneficiary.contact || 'N/A'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Category</span><span>{beneficiary.category || 'N/A'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Household</span><span>{beneficiary.householdSize} members</span></div>
          </div>
          {/* Access Card Section */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            {beneficiary.accessCardCode ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Access Card</p>
                  <p className="font-mono text-sm font-medium text-[#2E5C8A]">
                    {beneficiary.accessCardCode}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/beneficiary/${id}/card/print`)}
                    className="rounded bg-[#2E5C8A] px-3 py-1.5 text-xs text-white hover:bg-[#1e3d5e]"
                  >
                    Print Card
                  </button>
                  <button
                    onClick={handleReprint}
                    className="rounded border border-[#2E5C8A] px-3 py-1.5 text-xs text-[#2E5C8A] hover:bg-gray-50"
                  >
                    Reprint Card
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleAssignCard}
                disabled={assigning}
                className="w-full rounded bg-[#2E5C8A] px-4 py-2 text-sm text-white hover:bg-[#1e3d5e] disabled:opacity-50"
              >
                {assigning ? 'Assigning...' : 'Generate & Assign Access Card'}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#2E5C8A]"><FileText size={18} /> <h3 className="text-sm font-semibold">Active Cases</h3></div>
            <button className="rounded p-1 text-gray-400 hover:text-[#2E5C8A]"><Plus size={16} /></button>
          </div>
          {beneficiary.cases.length === 0 ? (
            <p className="text-sm text-gray-400">No active cases</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {beneficiary.cases.map(c => (
                <div key={c.id} className="flex items-center justify-between rounded bg-gray-50 p-2 text-sm">
                  <div>
                    <p className="font-medium text-gray-800">{c.program}</p>
                    <p className="text-xs text-gray-400">{c.id} · {c.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(c.status)}
                    {c.status === 'disbursed' && (
                      <button
                        onClick={() => setInterventionCaseId(c.id === interventionCaseId ? null : c.id)}
                        className="rounded bg-[#2E5C8A] px-2 py-1 text-xs text-white hover:bg-[#1e3d5e]"
                        title="Log Intervention"
                      >
                        <ClipboardList size={12} className="inline mr-1" />
                        Log Intervention
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
          <div className="mb-3 flex items-center gap-2 text-[#2E5C8A]"><Gift size={18} /> <h3 className="text-sm font-semibold">Interventions</h3></div>
          {beneficiary.interventions.length === 0 ? (
            <p className="text-sm text-gray-400">No interventions recorded</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {beneficiary.interventions.map(intv => (
                <div key={intv.id} className="rounded bg-gray-50 p-2 text-sm">
                  <p className="font-medium text-gray-800">{intv.type}</p>
                  <p className="text-xs text-gray-400">{intv.description}</p>
                  {intv.fundSource && <p className="text-xs font-medium text-[#2E5C8A]">Fund: {intv.fundSource}</p>}
                  <p className="text-xs text-gray-400">{intv.date}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Case Tracker Log Section */}
      <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
        <div className="mb-3 flex items-center gap-2 text-[#2E5C8A]">
          <FileText size={18} />
          <h3 className="text-sm font-semibold">Case Tracker Log</h3>
        </div>
        {trackerEntries.length === 0 ? (
          <p className="text-sm text-gray-400">No tracker entries</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {trackerEntries.map(entry => (
              <div key={entry.id} className="flex items-center justify-between rounded bg-gray-50 p-2 text-sm">
                <div>
                  <p className="font-medium text-gray-800">{entry.trackerId}</p>
                  <p className="text-xs text-gray-400">{entry.interventionRemarks}</p>
                </div>
                <span className="text-xs text-gray-500">#{entry.dailySeqNum}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Intervention Form (inline, shown when a disbursed case selected) */}
      {interventionCaseId && (
        <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
          <div className="mb-3 flex items-center gap-2 text-[#2E5C8A]">
            <ClipboardList size={18} />
            <h3 className="text-sm font-semibold">Log Intervention for Case {interventionCaseId}</h3>
          </div>
          {intError && <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{intError}</div>}
          <form onSubmit={handleLogIntervention} className="space-y-4 max-w-lg">
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={intForm.type} onChange={e => setIntForm({ ...intForm, type: e.target.value })} aria-label="Intervention Type">
                  <option value="FA">Financial Assistance</option>
                  <option value="C">Counseling</option>
                  <option value="CSR">CSR</option>
                  <option value="R">Referral</option>
                  <option value="H">Healthcare</option>
                  <option value="HV">Home Visit</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount (₱)</label>
                <input className="form-input" type="number" min="0" step="0.01" value={intForm.amount} onChange={e => setIntForm({ ...intForm, amount: e.target.value })} aria-label="Amount" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Fund Source</label>
              <select className="form-select" value={intForm.fundSource} onChange={e => setIntForm({ ...intForm, fundSource: e.target.value })} aria-label="Fund Source">
                <option value="Regular">Regular</option>
                <option value="PDAF">PDAF</option>
                <option value="Legislative">Legislative</option>
                <option value="Donation">Donation</option>
              </select>
            </div>
            <SignaturePad
              onSave={(dataUrl: string) => setIntSigDataUrl(dataUrl)}
              label="Worker Signature"
            />
            <div className="form-group">
              <label className="form-label">Client Receipt (optional photo)</label>
              <input
                type="file"
                accept="image/*"
                className="form-input"
                onChange={e => setIntReceiptFile(e.target.files?.[0] || null)}
                aria-label="Client Receipt"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={intSubmitting} aria-label="Submit Intervention">
                {intSubmitting ? 'Saving...' : 'Submit Intervention'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => { setInterventionCaseId(null); setIntError(''); setIntSigDataUrl(null); setIntReceiptFile(null); }} aria-label="Cancel">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {family.length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
          <button onClick={() => setFamilyExpanded(!familyExpanded)} className="flex items-center gap-2 text-[#2E5C8A] mb-3">
            {familyExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            <UsersIcon size={18} />
            <h3 className="text-sm font-semibold">Family Composition ({family.length})</h3>
          </button>
          {familyExpanded && (
            <div className="space-y-1">
              {family.map(m => (
                <div key={m.id} className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2E5C8A]/10 text-xs font-medium text-[#2E5C8A]">
                      {m.fullName.charAt(0)}
                    </span>
                    <div>
                      <p className="font-medium text-gray-800">{m.fullName} {m.isPrimary && <span className="text-xs text-[#2E5C8A]">(Primary)</span>}</p>
                      <p className="text-xs text-gray-500">{m.relationship} · {m.age} yrs</p>
                    </div>
                  </div>
                  {m.statusIncome && (
                    <span className="text-xs text-gray-400">{m.statusIncome}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Family Graph Section */}
      <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
        <div className="mb-4 flex items-center gap-2 text-[#2E5C8A]">
          <UsersIcon size={18} />
          <h3 className="text-sm font-semibold">Family Tree</h3>
        </div>
        {id && <FamilyGraph beneficiaryId={id} />}
      </div>

      {/* Consent Management Section */}
      <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
        <div className="mb-4 flex items-center gap-2 text-[#2E5C8A]">
          <Shield size={18} />
          <h3 className="text-sm font-semibold">Consent & Privacy</h3>
        </div>
        {id && beneficiary && (
          <ConsentManager
            beneficiaryId={id}
            currentConsentStatus={beneficiary.status}
            onConsentChange={handleConsentChange}
          />
        )}
      </div>
    </div>
  );
}
