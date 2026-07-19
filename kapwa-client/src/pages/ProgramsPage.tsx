import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Plus, ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, AlertTriangle, Shield, ExternalLink, User } from 'lucide-react';
import useSWR from 'swr';
import { api } from '../lib/api';
import { getCurrentUser } from '../lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface ApprovalStep {
  stepName: string;
  approverRole: string;
  slaDays: number;
  order: number;
}

interface ProgramRecord {
  id: string;
  name: string;
  category?: string;
  waitingPeriodDays?: number;
  legalBasis?: string;
  requiredDocuments?: string[];
  fundSources?: string[];
  approvalWorkflow?: ApprovalStep[];
  formTemplate?: Record<string, any>;
  formVersion: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AssignmentStep {
  id: string;
  assignmentId: string;
  stepOrder: number;
  stepName: string;
  approverRole: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  remarks?: string;
  createdAt: string;
}

interface ProgramAssignment {
  id: string;
  caseId: string;
  programId: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected';
  currentStepOrder: number;
  assignedWorkerId: string;
  createdAt: string;
  updatedAt: string;
  steps?: AssignmentStep[];
  programName?: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode; className?: string }> = {
  pending: { label: 'Pending', variant: 'secondary', icon: <Clock size={14} /> },
  in_review: { label: 'In Review', variant: 'default', icon: <AlertTriangle size={14} /> },
  approved: { label: 'Approved', variant: 'default', icon: <CheckCircle size={14} />, className: 'bg-emerald-500 hover:bg-emerald-500/80' },
  rejected: { label: 'Rejected', variant: 'destructive', icon: <XCircle size={14} /> },
};


export function ProgramsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'programs' | 'assignments'>('programs');
  const [user, setUser] = useState<any>(null);

  const [records, setRecords] = useState<ProgramRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [msg, setMsg] = useState('');

  const [assignments, setAssignments] = useState<ProgramAssignment[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [expandedAssignId, setExpandedAssignId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');
  const [rejectModal, setRejectModal] = useState<{ assignmentId: string; stepOrder: number; stepName: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [overrideModal, setOverrideModal] = useState<{ assignmentId: string; stepOrder: number; stepName: string } | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<'approved' | 'rejected'>('approved');
  const [overrideReason, setOverrideReason] = useState('');
  const [assignFilter, setAssignFilter] = useState<string>('');
  const [caseSearch, setCaseSearch] = useState('');

  useEffect(() => {
    getCurrentUser().then(setUser);
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (activeTab === 'assignments') loadAssignments();
  }, [activeTab]);

  const { data: usersData } = useSWR(
    activeTab === 'assignments' ? queryKeys.users.list() : null,
  );
  const { data: casesData } = useSWR(
    activeTab === 'assignments' ? queryKeys.cases.list() : null,
  );

  const workerMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (!usersData) return map;
    const list = Array.isArray(usersData) ? usersData : (usersData as any)?.data ?? [];
    for (const u of list) {
      map[u.id] = u.fullName || u.email || u.id.slice(0, 8);
    }
    return map;
  }, [usersData]);

  const caseMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (!casesData) return map;
    const list = Array.isArray(casesData) ? casesData : [];
    for (const c of list) {
      map[c.id] = c.controlNo || c.id.slice(0, 8);
    }
    return map;
  }, [casesData]);

  async function load(signal?: AbortSignal) {
    setLoading(true);
    try {
      const data = await api.get<ProgramRecord[]>("/programs");
      setRecords(data || []);
    } catch {
      setRecords([]);
    }
    setLoading(false);
  }

  async function loadAssignments() {
    setAssignLoading(true);
    try {
      const data = await api.get<ProgramAssignment[]>("/program-assignments");
      const enriched = (data || []).map((a: ProgramAssignment) => {
        const prog = records.find(r => r.id === a.programId);
        return { ...a, programName: prog?.name || 'Unknown Program' };
      });
      setAssignments(enriched);
    } catch { setAssignments([]); }
    setAssignLoading(false);
  }

  async function handleExpandAssignment(id: string) {
    if (expandedAssignId === id) {
      setExpandedAssignId(null);
      return;
    }
    setExpandedAssignId(id);
    try {
      const detail = await api.get<{ steps: AssignmentStep[]; status: ProgramAssignment['status'] }>(`/program-assignments/${id}`);
      setAssignments(prev => prev.map(a => a.id === id ? { ...a, steps: detail.steps, status: detail.status } : a));
    } catch { /* keep current state */ }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this program? This action cannot be undone.')) return;
    try {
      await api.del(`/programs/${id}`);
      setMsg('Program deleted');
      load();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Error deleting program');
    }
  }

  async function handleApproveStep(assignmentId: string, stepOrder: number) {
    setActionMsg('');
    try {
      await api.post(`/program-assignments/${assignmentId}/steps/${stepOrder}/approve`, { stepOrder });
      setActionMsg(`Step ${stepOrder + 1} approved successfully`);
      handleExpandAssignment(assignmentId);
      loadAssignments();
    } catch (err: unknown) {
      setActionMsg(err instanceof Error ? err.message : 'Error approving step');
    }
  }

  function openRejectModal(assignmentId: string, stepOrder: number, stepName: string) {
    setRejectModal({ assignmentId, stepOrder, stepName });
    setRejectReason('');
  }

  async function handleConfirmReject() {
    if (!rejectModal || !rejectReason.trim()) return;
    setActionMsg('');
    try {
      await api.post(`/program-assignments/${rejectModal.assignmentId}/steps/${rejectModal.stepOrder}/reject`, { stepOrder: rejectModal.stepOrder, remarks: rejectReason });
      setActionMsg(`Step ${rejectModal.stepOrder + 1} rejected`);
      setRejectModal(null);
      setRejectReason('');
      handleExpandAssignment(rejectModal.assignmentId);
      loadAssignments();
    } catch (err: unknown) {
      setActionMsg(err instanceof Error ? err.message : 'Error rejecting step');
    }
  }

  function openOverrideModal(assignmentId: string, stepOrder: number, stepName: string) {
    setOverrideModal({ assignmentId, stepOrder, stepName });
    setOverrideStatus('approved');
    setOverrideReason('');
  }

  async function handleConfirmOverride() {
    if (!overrideModal || !overrideReason.trim()) return;
    setActionMsg('');
    try {
      await api.post(`/program-assignments/${overrideModal.assignmentId}/steps/${overrideModal.stepOrder}/override`, { stepOrder: overrideModal.stepOrder, overrideStatus, remarks: overrideReason });
      setActionMsg(`Step ${overrideModal.stepOrder + 1} overridden to ${overrideStatus}`);
      setOverrideModal(null);
      setOverrideReason('');
      handleExpandAssignment(overrideModal.assignmentId);
      loadAssignments();
    } catch (err: unknown) {
      setActionMsg(err instanceof Error ? err.message : 'Error overriding step');
    }
  }

  const filteredAssignments = assignments.filter(a => {
    if (assignFilter && a.status !== assignFilter) return false;
    if (caseSearch) {
      return a.caseId.toLowerCase().includes(caseSearch.toLowerCase());
    }
    return true;
  });

  const filteredRecords = records.filter(r =>
    !searchTerm ||
    r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function canApproveStep(step: AssignmentStep): boolean {
    if (step.status !== 'pending') return false;
    if (!user) return false;
    return user.role === step.approverRole || user.role === 'admin';
  }

  return (
    <PageShell
      title="Programs & Assignments"
      description="Configure programs and manage assignment approval workflow"
    >
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit mb-4">
        <button
          onClick={() => setActiveTab('programs')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'programs' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label="Programs tab"
        >
          <FileText size={16} className="inline mr-1.5" />
          Programs
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'assignments' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label="Assignments tab"
        >
          <CheckCircle size={16} className="inline mr-1.5" />
          Assignments
        </button>
      </div>

      {msg && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-4">{msg}</div>
      )}

      {actionMsg && (
        <div className={`rounded-lg border px-4 py-3 text-sm mb-4 ${
          actionMsg.includes('Error') || actionMsg.includes('error')
            ? 'bg-destructive/10 border-destructive/20 text-destructive'
            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}>
          {actionMsg}
        </div>
      )}

      {/* ===== PROGRAMS TAB ===== */}
      {activeTab === 'programs' && (
        <>
          <div className="flex items-center justify-between gap-3 mb-4">
            <Button onClick={() => navigate('/programs/new')} aria-label="New Program" className="gap-1.5">
              <Plus size={16} /> New Program
            </Button>
            <Input
              type="text"
              placeholder="Search programs..."
              className="max-w-xs h-9"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              aria-label="Search programs"
            />
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading programs...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="rounded-lg border bg-card shadow-sm text-center py-12 text-muted-foreground">
              <FileText className="mx-auto mb-2" size={32} />
              <p>No programs configured yet. Create your first intervention program.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecords.map(r => (
                <div key={r.id} className="rounded-lg border bg-card shadow-sm overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${r.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                        <div>
                          <span className="font-semibold text-foreground">{r.name}</span>
                          {r.category && <span className="ml-2 text-xs text-muted-foreground">| {r.category}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.legalBasis && (
                          <span className="text-xs text-muted-foreground hidden md:inline">{r.legalBasis}</span>
                        )}
                        <Badge variant={r.isActive ? 'default' : 'secondary'} className={`shrink-0 ${r.isActive ? 'bg-emerald-500' : ''}`}>
                          {r.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {r.waitingPeriodDays != null && <span>Wait: {r.waitingPeriodDays}d</span>}
                      {r.requiredDocuments?.length ? <span>Docs: {r.requiredDocuments.length}</span> : null}
                      {r.fundSources?.length ? <span>Funds: {r.fundSources.join(', ')}</span> : null}
                      {r.approvalWorkflow?.length ? <span>Steps: {r.approvalWorkflow.length}</span> : null}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/programs/${r.id}`)}
                        aria-label="View details"
                        className="h-8"
                      >
                        <ExternalLink size={14} className="mr-1" />
                        View Details
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} aria-label="Delete" className="h-8 text-destructive hover:text-destructive">
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== ASSIGNMENTS TAB ===== */}
      {activeTab === 'assignments' && (
        <>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <select
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={assignFilter}
                onChange={e => setAssignFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_review">In Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <Input
              type="text"
              placeholder="Search by case ID..."
              className="max-w-xs h-9"
              value={caseSearch}
              onChange={e => setCaseSearch(e.target.value)}
              aria-label="Search assignments by case ID"
            />
          </div>

          {assignLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading assignments...</div>
          ) : filteredAssignments.length === 0 ? (
            <div className="rounded-lg border bg-card shadow-sm text-center py-12 text-muted-foreground">
              <CheckCircle className="mx-auto mb-2" size={32} />
              <p>No program assignments found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAssignments.map(a => {
                const sc = STATUS_CONFIG[a.status];
                return (
                  <div key={a.id} className="rounded-lg border bg-card shadow-sm overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-muted-foreground">{sc?.icon}</div>
                          <div>
                            <span className="font-semibold text-foreground">{a.programName || 'Program'}</span>
                            {caseMap[a.caseId] && <span className="ml-2 text-xs text-muted-foreground">Case: {caseMap[a.caseId]}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={sc?.variant || 'outline'} className={`shrink-0 gap-1 ${sc?.className || ''}`}>
                            {sc?.icon}{sc?.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(a.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User size={12} />
                          {workerMap[a.assignedWorkerId] || `${a.assignedWorkerId?.slice(0, 8)}...`}
                        </span>
                        {a.currentStepOrder > 0 && <span>Current Step: {a.currentStepOrder + 1}</span>}
                      </div>
                      <div className="mt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExpandAssignment(a.id)}
                          aria-label="View steps"
                          className="h-8"
                        >
                          {expandedAssignId === a.id ? <ChevronUp size={14} className="mr-1" /> : <ChevronDown size={14} className="mr-1" />}
                          {expandedAssignId === a.id ? 'Hide Steps' : 'View Steps'}
                        </Button>
                      </div>

                      {expandedAssignId === a.id && a.steps && (
                        <div className="mt-4 border-t border-border/60 pt-4 space-y-3">
                          <span className="text-xs text-muted-foreground font-semibold">Approval Steps</span>
                          {a.steps.map((step, i) => {
                            const stepSc = STATUS_CONFIG[step.status];
                            const canAct = canApproveStep(step);
                            return (
                              <div key={step.id} className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3">
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold shrink-0 ${
                                  step.status === 'approved' ? 'bg-emerald-500' :
                                  step.status === 'rejected' ? 'bg-destructive' :
                                  'bg-muted-foreground/40'
                                }`}>
                                  {i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-foreground">{step.stepName}</span>
                                    <Badge variant={stepSc?.variant || 'outline'} className={`shrink-0 text-[11px] gap-1 ${stepSc?.className || ''}`}>
                                      {stepSc?.icon}{stepSc?.label}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">({step.approverRole})</span>
                                  </div>
                                  {step.remarks && (
                                    <p className="mt-1 text-xs text-muted-foreground italic">
                                      {step.status === 'rejected' ? 'Reason: ' : 'Note: '}
                                      {step.remarks}
                                    </p>
                                  )}
                                  {step.approvedBy && (
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                      {step.status === 'approved' ? 'Approved' : 'Processed'} by {step.approvedBy}
                                      {step.approvedAt ? ` on ${new Date(step.approvedAt).toLocaleDateString()}` : ''}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {canAct && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleApproveStep(a.id, step.stepOrder)}
                                        aria-label={`Approve step ${i + 1}`}
                                        title="Approve"
                                        className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                      >
                                        <CheckCircle size={16} />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openRejectModal(a.id, step.stepOrder, step.stepName)}
                                        aria-label={`Reject step ${i + 1}`}
                                        title="Reject"
                                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      >
                                        <XCircle size={16} />
                                      </Button>
                                    </>
                                  )}
                                  {user?.role === 'admin' && step.status === 'pending' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openOverrideModal(a.id, step.stepOrder, step.stepName)}
                                      aria-label={`Override step ${i + 1}`}
                                      title="Admin Override"
                                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                    >
                                      <Shield size={16} />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Reject Modal */}
          {rejectModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setRejectModal(null)}>
              <div className="rounded-lg border bg-card shadow-lg p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-sm font-semibold text-foreground mb-4">Reject Step: {rejectModal.stepName}</h3>
                <div className="space-y-1 mb-4">
                  <label className="text-xs text-muted-foreground font-medium">Reason for rejection *</label>
                  <textarea
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y min-h-[80px]"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Explain why this step is being rejected..."
                    aria-label="Rejection reason"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setRejectModal(null)} aria-label="Cancel rejection">Cancel</Button>
                  <Button variant="destructive" disabled={!rejectReason.trim()} onClick={handleConfirmReject} aria-label="Confirm rejection">Reject Step</Button>
                </div>
              </div>
            </div>
          )}

          {/* Override Modal */}
          {overrideModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOverrideModal(null)}>
              <div className="rounded-lg border bg-card shadow-lg p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-sm font-semibold text-foreground mb-4">Admin Override: {overrideModal.stepName}</h3>
                <div className="space-y-1 mb-4">
                  <label className="text-xs text-muted-foreground font-medium">Override Status</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={overrideStatus}
                    onChange={e => setOverrideStatus(e.target.value as 'approved' | 'rejected')}
                    aria-label="Override status"
                  >
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="space-y-1 mb-4">
                  <label className="text-xs text-muted-foreground font-medium">Reason *</label>
                  <textarea
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y min-h-[80px]"
                    value={overrideReason}
                    onChange={e => setOverrideReason(e.target.value)}
                    placeholder="Explain the override reason..."
                    aria-label="Override reason"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setOverrideModal(null)} aria-label="Cancel override">Cancel</Button>
                  <Button
                    disabled={!overrideReason.trim()}
                    onClick={handleConfirmOverride}
                    aria-label="Confirm override"
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    Apply Override
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
