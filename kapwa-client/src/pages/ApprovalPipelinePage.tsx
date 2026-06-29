import { useState, useEffect } from 'react';
import { getCases, updateCaseStatus, updateCaseDocuments, approveCase } from '../lib/api';
import { getCurrentUser } from '../lib/auth-context';
import SignaturePad from '../components/forms/SignaturePad';
import { CheckCircle, Upload, FileText, ArrowRight } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ApprovalCase {
  id: string;
  controlNo: string;
  status: string;
  serviceRequested?: string[];
  requirementsChecklist?: Record<string, boolean>;
  certificateUrl?: string;
  pettyCashVoucherUrl?: string;
  beneficiary?: { firstName?: string; surname?: string };
  assignedWorkerId?: string;
  updatedAt: string;
}

export function ApprovalPipelinePage() {
  const [cases, setCases] = useState<ApprovalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [selectedCase, setSelectedCase] = useState<ApprovalCase | null>(null);
  const [signature, setSignature] = useState<string>('');
  const [action, setAction] = useState<'approve' | 'disburse' | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    getCurrentUser().then(setUser);
    loadCases(ac.signal);
    return () => ac.abort();
  }, []);

  async function loadCases(signal?: AbortSignal) {
    try {
      const data = await getCases(undefined, signal);
      setCases(data || []);
      setLastSync(Date.now());
    } catch { setCases([]); }
    setLoading(false);
  }

  const pipelineStatus = ['in_review', 'approved', 'disbursed'];
  const grouped = pipelineStatus.map(status => ({
    status,
    label: status === 'in_review' ? 'In Review' : status === 'approved' ? 'Approved' : 'Disbursed',
    items: cases.filter(c => c.status === status),
  }));

  async function handleCertificateUpload(caseId: string, file: File) {
    const token = localStorage.getItem('kapwa_token');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', 'certificate_of_eligibility');
    formData.append('caseId', caseId);
    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/filing/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (res.ok) {
      const doc = await res.json();
      await updateCaseDocuments(caseId, { certificateUrl: `/api/filing/file/${doc.id}` });
      await loadCases();
    }
  }

  async function handleVoucherUpload(caseId: string, file: File) {
    const token = localStorage.getItem('kapwa_token');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', 'petty_cash_voucher');
    formData.append('caseId', caseId);
    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/filing/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (res.ok) {
      const doc = await res.json();
      await updateCaseDocuments(caseId, { pettyCashVoucherUrl: `/api/filing/file/${doc.id}` });
      await loadCases();
    }
  }

  async function handleApprove(caseId: string) {
    setSaving(true);
    try {
      const targetStatus = action === 'disburse' ? 'disbursed' : 'approved';
      await approveCase(caseId, targetStatus, signature);
      setSelectedCase(null);
      setAction(null);
      setSignature('');
      await loadCases();
    } catch (e) { console.error('Approve failed', e); }
    setSaving(false);
  }

  function openApproval(c: ApprovalCase, act: 'approve' | 'disburse') {
    setSelectedCase(c);
    setAction(act);
    setSignature('');
  }

  if (loading) {
    return (
      <PageShell title="Approval Pipeline" description="Certificate of Eligibility review, Petty Cash Voucher management, and sign-off.">
        <TableSkeleton rows={5} />
      </PageShell>
    );
  }

  const allEmpty = grouped.every(g => g.items.length === 0);

  return (
    <PageShell
      title="Approval Pipeline"
      description="Certificate of Eligibility review, Petty Cash Voucher management, and sign-off."
      cachedAt={lastSync ?? undefined}
    >
      {allEmpty ? (
        <EmptyState variant="no-data" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {grouped.map(group => (
            <div key={group.status} className="bg-card rounded-lg border border-border p-4">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  group.status === 'in_review' ? 'bg-amber-400' :
                  group.status === 'approved' ? 'bg-green-400' : 'bg-blue-400'
                }`} />
                {group.label}
                <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{group.items.length}</span>
              </h3>
              <div className="space-y-3">
                {group.items.map(c => (
                  <div key={c.id} className="border border-border rounded-lg p-3 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="font-medium text-sm text-foreground">{c.controlNo}</span>
                        {c.beneficiary && (
                          <p className="text-xs text-muted-foreground mt-0.5">{c.beneficiary.surname}, {c.beneficiary.firstName}</p>
                        )}
                      </div>
                      <Badge variant={
                        c.status === 'in_review' ? 'secondary' :
                        c.status === 'approved' ? 'default' : 'secondary'
                      }>{group.label}</Badge>
                    </div>
                    {c.serviceRequested && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {c.serviceRequested.map((s, i) => (
                          <span key={i} className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                      </div>
                    )}

                    {group.status === 'in_review' && (
                      <div className="space-y-1.5 mt-2 pt-2 border-t border-border">
                        {!c.certificateUrl ? (
                          <label className="flex items-center gap-2 text-xs text-amber-600 cursor-pointer hover:text-amber-700">
                            <Upload size={14} /> Upload Certificate of Eligibility
                            <input type="file" className="hidden" accept=".pdf,.jpg,.png" onChange={e => {
                              const f = e.target.files?.[0]; if (f) handleCertificateUpload(c.id, f);
                            }} />
                          </label>
                        ) : (
                          <a href={c.certificateUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-green-600 hover:text-green-700">
                            <FileText size={14} /> View Certificate
                          </a>
                        )}
                        {!c.pettyCashVoucherUrl ? (
                          <label className="flex items-center gap-2 text-xs text-amber-600 cursor-pointer hover:text-amber-700">
                            <Upload size={14} /> Upload Petty Cash Voucher
                            <input type="file" className="hidden" accept=".pdf,.jpg,.png" onChange={e => {
                              const f = e.target.files?.[0]; if (f) handleVoucherUpload(c.id, f);
                            }} />
                          </label>
                        ) : (
                          <a href={c.pettyCashVoucherUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-green-600 hover:text-green-700">
                            <FileText size={14} /> View Voucher
                          </a>
                        )}
                        {c.certificateUrl && c.pettyCashVoucherUrl && user?.role === 'admin' && (
                          <Button onClick={() => openApproval(c, 'approve')} size="sm" className="w-full mt-1">
                            <CheckCircle size={14} /> Approve & Sign
                          </Button>
                        )}
                      </div>
                    )}

                    {(group.status === 'approved' || group.status === 'disbursed') && (
                      <div className="space-y-1.5 mt-2 pt-2 border-t border-border">
                        {c.certificateUrl && (
                          <a href={c.certificateUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-green-600">
                            <FileText size={14} /> View Certificate
                          </a>
                        )}
                        {c.pettyCashVoucherUrl && (
                          <a href={c.pettyCashVoucherUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-green-600">
                            <FileText size={14} /> View Voucher
                          </a>
                        )}
                        {group.status === 'approved' && user?.role === 'admin' && (
                          <Button onClick={() => openApproval(c, 'disburse')} size="sm" variant="secondary" className="w-full mt-1">
                            <ArrowRight size={14} /> Mark Disbursed
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {group.items.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No cases</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Signature Modal */}
      {selectedCase && action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-xl shadow-xl p-6 w-full max-w-md border border-border">
            <h3 className="font-semibold text-foreground mb-1">
              {action === 'approve' ? 'Approve Case' : 'Mark as Disbursed'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">{selectedCase.controlNo}</p>

            <SignaturePad onSave={setSignature} label="Authorized Signatory E-Signature" />

            {signature && (
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-1">Signature Preview:</p>
                <img src={signature} alt="Signature" className="h-12 border rounded bg-card" />
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => { setSelectedCase(null); setAction(null); }} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => handleApprove(selectedCase.id)} disabled={!signature || saving}>
                {saving ? 'Saving...' : <><CheckCircle size={16} /> {action === 'approve' ? 'Approve' : 'Disburse'}</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
