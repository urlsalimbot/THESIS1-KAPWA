import { useState, useEffect, useCallback } from 'react';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { getCurrentUser } from '../lib/auth-context';
import SignaturePad from '../components/forms/SignaturePad';
import { CheckCircle, Upload, FileText, ArrowRight, ListChecks } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { BulkActionBar } from '@/components/bulk-actions/BulkActionBar';
import { BulkApproveDialog } from '@/components/bulk-actions/BulkApproveDialog';
import { BulkExportDialog } from '@/components/bulk-actions/BulkExportDialog';
import { showBulkProgress } from '@/components/bulk-actions/BulkProgressToast';

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
  const { mutate: globalMutate } = useSWRConfig();
  const { data: cases = [], isLoading: loading } = useSWR<ApprovalCase[]>(queryKeys.cases.list());
  const [user, setUser] = useState<any>(null);
  const [selectedCase, setSelectedCase] = useState<ApprovalCase | null>(null);
  const [signature, setSignature] = useState<string>('');
  const [action, setAction] = useState<'approve' | 'disburse' | null>(null);
  const [saving, setSaving] = useState(false);
  const lastSync = cases.length > 0 ? Date.now() : null;
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkApproveDialogOpen, setBulkApproveDialogOpen] = useState(false);
  const [bulkExportDialogOpen, setBulkExportDialogOpen] = useState(false);

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  const toggleSelectMode = useCallback(() => {
    setSelectMode(prev => !prev);
    setSelectedIds(new Set());
  }, []);

  const toggleSelectId = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const pipelineStatus = ['in_review', 'approved', 'disbursed'];
  const grouped = pipelineStatus.map(status => ({
    status,
    label: status === 'in_review' ? 'In Review' : status === 'approved' ? 'Approved' : 'Disbursed',
    items: cases.filter(c => c.status === status),
  }));

  // FormData uploads stay on raw fetch (D-10 deferred — JSON-only api client).
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
      await api.put(`/cases/${caseId}/documents`, { certificateUrl: `/api/filing/file/${doc.id}` });
      globalMutate(queryKeys.cases.all);
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
      await api.put(`/cases/${caseId}/documents`, { pettyCashVoucherUrl: `/api/filing/file/${doc.id}` });
      globalMutate(queryKeys.cases.all);
    }
  }

  async function handleApprove(caseId: string) {
    setSaving(true);
    try {
      const targetStatus = action === 'disburse' ? 'disbursed' : 'approved';
      await api.put(`/cases/${caseId}/approve`, { status: targetStatus, signature });
      setSelectedCase(null);
      setAction(null);
      setSignature('');
      globalMutate(queryKeys.cases.all);
    } catch (e) { console.error('Approve failed', e); }
    setSaving(false);
  }

  async function handleBulkApprove() {
    const ids = Array.from(selectedIds);
    await showBulkProgress(ids, async (id) => {
      await api.post('/cases/bulk-approve', { ids: [id] });
    }, 'Approving');
    globalMutate(queryKeys.cases.all);
    clearSelection();
  }

  function openApproval(c: ApprovalCase, act: 'approve' | 'disburse') {
    setSelectedCase(c);
    setAction(act);
    setSignature('');
  }

  const selectAllChecked = cases.length > 0 && cases.every(c => selectedIds.has(c.id));
  const selectSomeChecked = cases.some(c => selectedIds.has(c.id)) && !selectAllChecked;

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
      actions={
        <Button
          variant={selectMode ? 'default' : 'outline'}
          size="sm"
          onClick={toggleSelectMode}
        >
          <ListChecks size={16} className="mr-1.5" />
          {selectMode ? 'Exit Select Mode' : 'Select Mode'}
        </Button>
      }
    >
      {selectMode && cases.length > 0 && (
        <div className="flex items-center gap-2 px-1 mb-2">
          <Checkbox
            checked={selectAllChecked || (selectSomeChecked ? 'indeterminate' : false)}
            onCheckedChange={() => {
              if (selectAllChecked) {
                setSelectedIds(new Set());
              } else {
                setSelectedIds(new Set(cases.map(c => c.id)));
              }
            }}
            aria-label="Select all cases"
          />
          <span className="text-sm text-muted-foreground">
            Select all cases
          </span>
        </div>
      )}

      {allEmpty ? (
        <EmptyState variant="no-data" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {grouped.map(group => (
            <div key={group.status} className="bg-card rounded-lg border border-border p-4">
              <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-base">
                <span className={`w-2 h-2 rounded-full ${
                  group.status === 'in_review' ? 'bg-amber-400' :
                  group.status === 'approved' ? 'bg-green-400' : 'bg-blue-400'
                }`} />
                {group.label}
                <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{group.items.length}</span>
              </h2>
              <div className="space-y-3">
                {group.items.map(c => (
                  <div key={c.id} className="border border-border rounded-lg p-3 hover:shadow-sm transition-shadow">
                    {selectMode && (
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
                        <Checkbox
                          checked={selectedIds.has(c.id)}
                          onCheckedChange={() => toggleSelectId(c.id)}
                          aria-label={`Select ${c.controlNo}`}
                        />
                        <span className="text-xs font-medium text-muted-foreground">
                          {selectedIds.has(c.id) ? 'Selected' : 'Select'}
                        </span>
                      </div>
                    )}
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

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        selectedIds={Array.from(selectedIds)}
        onApprove={() => selectedIds.size > 0 && setBulkApproveDialogOpen(true)}
        onReassign={() => {}}
        onExport={() => selectedIds.size > 0 && setBulkExportDialogOpen(true)}
        onClearSelection={clearSelection}
      />

      {/* Bulk Approve Dialog */}
      <BulkApproveDialog
        open={bulkApproveDialogOpen}
        onOpenChange={setBulkApproveDialogOpen}
        selectedCount={selectedIds.size}
        selectedIds={Array.from(selectedIds)}
        onConfirm={handleBulkApprove}
      />

      {/* Bulk Export Dialog */}
      <BulkExportDialog
        open={bulkExportDialogOpen}
        onOpenChange={setBulkExportDialogOpen}
        selectedIds={Array.from(selectedIds)}
        onComplete={() => {
          clearSelection();
          setSelectMode(false);
        }}
      />

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
