import React, { useState, useEffect } from 'react';
import { FileText, Plus, ChevronDown, ChevronUp, X, CheckCircle, XCircle, Clock, AlertTriangle, Shield } from 'lucide-react';
import { getPrograms, createProgram, updateProgram, deleteProgram } from '../lib/api';
import { getProgramAssignments, getProgramAssignment, createProgramAssignment, approveAssignmentStep, rejectAssignmentStep, overrideAssignmentStep } from '../lib/api';
import { getCurrentUser } from '../lib/auth-context';
import JsonSchemaForm from '../components/forms/JsonSchemaForm';
import { PageShell } from '@/components/PageShell';

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

interface ProgramForm {
  name: string;
  category: string;
  waitingPeriodDays: string;
  legalBasis: string;
  requiredDocuments: string[];
  fundSources: string[];
  approvalWorkflow: ApprovalStep[];
  formTemplate: string;
  isActive: boolean;
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

const emptyForm: ProgramForm = {
  name: '',
  category: '',
  waitingPeriodDays: '',
  legalBasis: '',
  requiredDocuments: [],
  fundSources: [],
  approvalWorkflow: [],
  formTemplate: '',
  isActive: true,
};

function parseJsonTemplate(s: string): Record<string, any> | null {
  if (!s.trim()) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending': return { label: 'Pending', cls: 'bg-yellow-100 text-yellow-700' };
    case 'in_review': return { label: 'In Review', cls: 'bg-blue-100 text-blue-700' };
    case 'approved': return { label: 'Approved', cls: 'bg-green-100 text-green-700' };
    case 'rejected': return { label: 'Rejected', cls: 'bg-red-100 text-red-700' };
    default: return { label: status, cls: 'bg-gray-100 text-gray-500' };
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'pending': return <Clock size={16} className="text-yellow-500" />;
    case 'in_review': return <AlertTriangle size={16} className="text-blue-500" />;
    case 'approved': return <CheckCircle size={16} className="text-green-500" />;
    case 'rejected': return <XCircle size={16} className="text-red-500" />;
    default: return null;
  }
}

export function ProgramsPage() {
  const [activeTab, setActiveTab] = useState<'programs' | 'assignments'>('programs');
  const [user, setUser] = useState<any>(null);

  // Programs state
  const [records, setRecords] = useState<ProgramRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProgramForm>(emptyForm);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [msg, setMsg] = useState('');
  const [jsonError, setJsonError] = useState('');

  // Assignments state
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

  async function load(signal?: AbortSignal) {
    setLoading(true);
    try {
      const data = await getPrograms();
      setRecords(data || []);
    } catch {
      setRecords([]);
    }
    setLoading(false);
  }

  async function loadAssignments() {
    setAssignLoading(true);
    try {
      const data = await getProgramAssignments();
      // Enrich with program names
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
      const detail = await getProgramAssignment(id);
      setAssignments(prev => prev.map(a => a.id === id ? { ...a, steps: detail.steps, status: detail.status } : a));
    } catch { /* keep current state */ }
  }

  // Programs CRUD
  function openNew() {
    setForm(emptyForm);
    setEditingId(null);
    setJsonError('');
    setShowForm(true);
  }

  function openEdit(r: ProgramRecord) {
    setForm({
      name: r.name || '',
      category: r.category || '',
      waitingPeriodDays: r.waitingPeriodDays != null ? String(r.waitingPeriodDays) : '',
      legalBasis: r.legalBasis || '',
      requiredDocuments: r.requiredDocuments || [],
      fundSources: r.fundSources || [],
      approvalWorkflow: r.approvalWorkflow || [],
      formTemplate: r.formTemplate ? JSON.stringify(r.formTemplate, null, 2) : '',
      isActive: r.isActive,
    });
    setEditingId(r.id);
    setJsonError('');
    setShowForm(true);
  }

  function updateForm(field: keyof ProgramForm, value: string | number | boolean | string[] | ApprovalStep[]) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function addRequiredDoc() {
    setForm(prev => ({ ...prev, requiredDocuments: [...prev.requiredDocuments, ''] }));
  }

  function updateRequiredDoc(index: number, value: string) {
    setForm(prev => {
      const docs = [...prev.requiredDocuments];
      docs[index] = value;
      return { ...prev, requiredDocuments: docs };
    });
  }

  function removeRequiredDoc(index: number) {
    setForm(prev => ({
      ...prev,
      requiredDocuments: prev.requiredDocuments.filter((_, i) => i !== index),
    }));
  }

  function addFundSource() {
    setForm(prev => ({ ...prev, fundSources: [...prev.fundSources, ''] }));
  }

  function updateFundSource(index: number, value: string) {
    setForm(prev => {
      const sources = [...prev.fundSources];
      sources[index] = value;
      return { ...prev, fundSources: sources };
    });
  }

  function removeFundSource(index: number) {
    setForm(prev => ({
      ...prev,
      fundSources: prev.fundSources.filter((_, i) => i !== index),
    }));
  }

  function addWorkflowStep() {
    setForm(prev => ({
      ...prev,
      approvalWorkflow: [
        ...prev.approvalWorkflow,
        { stepName: '', approverRole: '', slaDays: 3, order: prev.approvalWorkflow.length },
      ],
    }));
  }

  function updateWorkflowStep(index: number, field: keyof ApprovalStep, value: string | number) {
    setForm(prev => {
      const steps = [...prev.approvalWorkflow];
      steps[index] = { ...steps[index], [field]: value };
      return { ...prev, approvalWorkflow: steps };
    });
  }

  function removeWorkflowStep(index: number) {
    setForm(prev => {
      const steps = prev.approvalWorkflow
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, order: i }));
      return { ...prev, approvalWorkflow: steps };
    });
  }

  function getSubmitData(): Record<string, unknown> {
    const data: Record<string, unknown> = {
      name: form.name,
      category: form.category || undefined,
      waitingPeriodDays: form.waitingPeriodDays ? parseInt(form.waitingPeriodDays, 10) : undefined,
      legalBasis: form.legalBasis || undefined,
      requiredDocuments: form.requiredDocuments.filter(d => d.trim()).length > 0
        ? form.requiredDocuments.filter(d => d.trim()) : undefined,
      fundSources: form.fundSources.filter(s => s.trim()).length > 0
        ? form.fundSources.filter(s => s.trim()) : undefined,
      approvalWorkflow: form.approvalWorkflow.length > 0 ? form.approvalWorkflow : undefined,
      isActive: form.isActive,
    };
    const parsed = parseJsonTemplate(form.formTemplate);
    if (parsed) {
      data.formTemplate = parsed;
    }
    return data;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setJsonError('');

    if (form.formTemplate.trim()) {
      const parsed = parseJsonTemplate(form.formTemplate);
      if (!parsed) {
        setJsonError('Invalid JSON in form template. Please fix syntax errors.');
        return;
      }
    }

    try {
      const submitData = getSubmitData();
      if (editingId) {
        await updateProgram(editingId, submitData);
        setMsg('Program updated successfully');
      } else {
        await createProgram(submitData);
        setMsg('Program created successfully');
      }
      setShowForm(false);
      load();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Error saving program');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this program? This action cannot be undone.')) return;
    try {
      await deleteProgram(id);
      setMsg('Program deleted');
      load();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Error deleting program');
    }
  }

  // Assignment actions
  async function handleApproveStep(assignmentId: string, stepOrder: number) {
    setActionMsg('');
    try {
      await approveAssignmentStep(assignmentId, stepOrder);
      setActionMsg(`Step ${stepOrder + 1} approved successfully`);
      // Reload
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
      await rejectAssignmentStep(rejectModal.assignmentId, rejectModal.stepOrder, rejectReason);
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
      await overrideAssignmentStep(overrideModal.assignmentId, overrideModal.stepOrder, overrideStatus, overrideReason);
      setActionMsg(`Step ${overrideModal.stepOrder + 1} overridden to ${overrideStatus}`);
      setOverrideModal(null);
      setOverrideReason('');
      handleExpandAssignment(overrideModal.assignmentId);
      loadAssignments();
    } catch (err: unknown) {
      setActionMsg(err instanceof Error ? err.message : 'Error overriding step');
    }
  }

  // Filter assignments
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

  const parsedFormTemplate = parseJsonTemplate(form.formTemplate);

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

      {/* Tab toggle */}
      <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        <button
          onClick={() => setActiveTab('programs')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'programs' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
          aria-label="Programs tab"
        >
          <FileText size={16} className="inline mr-1.5" />
          Programs
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'assignments' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
          aria-label="Assignments tab"
        >
          <CheckCircle size={16} className="inline mr-1.5" />
          Assignments
        </button>
      </div>

      {msg && (
        <div className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {msg}
        </div>
      )}

      {actionMsg && (
        <div className={`mb-4 rounded border p-3 text-sm ${
          actionMsg.includes('Error') || actionMsg.includes('error')
            ? 'border-red-300 bg-red-50 text-red-800'
            : 'border-green-300 bg-green-50 text-green-800'
        }`}>
          {actionMsg}
        </div>
      )}

      {/* ===== PROGRAMS TAB ===== */}
      {activeTab === 'programs' && (
        <>
          <div className="toolbar">
            <div className="toolbar-left">
              <button className="btn btn-primary" onClick={openNew} aria-label="+ New Program">
                <Plus size={16} className="inline mr-1" /> New Program
              </button>
            </div>
            <div className="toolbar-right">
              <input
                type="text"
                placeholder="Search programs..."
                className="form-input max-w-xs"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                aria-label="Search programs"
              />
            </div>
          </div>

          {showForm && (
            <div className="card mb-6 max-w-4xl">
              <h3 className="font-heading font-semibold mb-4">
                {editingId ? 'Edit Program' : 'New Program'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-primary">Basic Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="form-label">Program Name *</label>
                      <input
                        className="form-input"
                        required
                        value={form.name}
                        onChange={e => updateForm('name', e.target.value)}
                        placeholder="e.g. AICS, Medical Assistance"
                        aria-label="Program Name"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Category</label>
                      <input
                        className="form-input"
                        value={form.category}
                        onChange={e => updateForm('category', e.target.value)}
                        placeholder="e.g. Medical Assistance"
                        aria-label="Category"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Waiting Period (days)</label>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        value={form.waitingPeriodDays}
                        onChange={e => updateForm('waitingPeriodDays', e.target.value)}
                        placeholder="e.g. 3"
                        aria-label="Waiting Period Days"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Legal Basis</label>
                      <input
                        className="form-input"
                        value={form.legalBasis}
                        onChange={e => updateForm('legalBasis', e.target.value)}
                        placeholder="e.g. RA 11223"
                        aria-label="Legal Basis"
                      />
                    </div>
                  </div>
                  <div className="form-group mt-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={e => updateForm('isActive', e.target.checked)}
                        className="rounded border-gray-300 text-primary"
                        aria-label="Active"
                      />
                      Active
                    </label>
                  </div>
                </div>

                {/* Required Documents */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-primary">Required Documents</h4>
                  {form.requiredDocuments.map((doc, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <input
                        className="form-input flex-1"
                        value={doc}
                        onChange={e => updateRequiredDoc(i, e.target.value)}
                        placeholder="Document name (e.g. Valid ID)"
                        aria-label={`Required document ${i + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeRequiredDoc(i)}
                        className="text-red-500 hover:text-red-700"
                        aria-label={`Remove document ${i + 1}`}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn-text btn-text-sm mt-1" onClick={addRequiredDoc} aria-label="Add document">
                    + Add Document
                  </button>
                </div>

                {/* Fund Sources */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-primary">Fund Sources</h4>
                  {form.fundSources.map((src, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <input
                        className="form-input flex-1"
                        value={src}
                        onChange={e => updateFundSource(i, e.target.value)}
                        placeholder="Fund source (e.g. DSWD, LGU)"
                        aria-label={`Fund source ${i + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeFundSource(i)}
                        className="text-red-500 hover:text-red-700"
                        aria-label={`Remove fund source ${i + 1}`}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn-text btn-text-sm mt-1" onClick={addFundSource} aria-label="Add fund source">
                    + Add Fund Source
                  </button>
                </div>

                {/* Approval Workflow */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-primary">Approval Workflow</h4>
                  {form.approvalWorkflow.map((step, i) => (
                    <div key={i} className="mb-3 rounded border border-gray-200 bg-white p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500">Step {i + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeWorkflowStep(i)}
                          className="text-red-500 hover:text-red-700"
                          aria-label={`Remove step ${i + 1}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <div className="form-group">
                          <label className="text-xs text-gray-500">Step Name</label>
                          <input
                            className="form-input text-sm"
                            value={step.stepName}
                            onChange={e => updateWorkflowStep(i, 'stepName', e.target.value)}
                            placeholder="e.g. Intake Review"
                            aria-label={`Step ${i + 1} name`}
                          />
                        </div>
                        <div className="form-group">
                          <label className="text-xs text-gray-500">Approver Role</label>
                          <input
                            className="form-input text-sm"
                            value={step.approverRole}
                            onChange={e => updateWorkflowStep(i, 'approverRole', e.target.value)}
                            placeholder="e.g. social_worker"
                            aria-label={`Step ${i + 1} approver role`}
                          />
                        </div>
                        <div className="form-group">
                          <label className="text-xs text-gray-500">SLA (days)</label>
                          <input
                            className="form-input text-sm"
                            type="number"
                            min="1"
                            value={step.slaDays}
                            onChange={e => updateWorkflowStep(i, 'slaDays', parseInt(e.target.value) || 1)}
                            aria-label={`Step ${i + 1} SLA days`}
                          />
                        </div>
                        <div className="form-group">
                          <label className="text-xs text-gray-500">Order</label>
                          <input
                            className="form-input text-sm bg-gray-100"
                            value={step.order}
                            readOnly
                            aria-label={`Step ${i + 1} order`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button type="button" className="btn-text btn-text-sm mt-1" onClick={addWorkflowStep} aria-label="Add workflow step">
                    + Add Step
                  </button>
                </div>

                {/* Form Template (JSON Schema) */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-primary">Form Template (JSON Schema)</h4>
                  <textarea
                    className="form-input font-mono text-xs min-h-[120px]"
                    value={form.formTemplate}
                    onChange={e => {
                      updateForm('formTemplate', e.target.value);
                      setJsonError('');
                    }}
                    placeholder='Paste JSON Schema here, e.g.{"type":"object","properties":{"field1":{"type":"string"}}}'
                    aria-label="Form Template JSON"
                  />
                  {jsonError && <p className="mt-1 text-xs text-red-500">{jsonError}</p>}

                  {parsedFormTemplate && parsedFormTemplate.type === 'object' && (
                    <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-3">
                      <p className="mb-2 text-xs font-semibold text-blue-700">Form Preview</p>
                      <JsonSchemaForm
                        schema={parsedFormTemplate as any}
                        readOnly={true}
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button type="submit" className="btn btn-primary" aria-label="Save program">
                    {editingId ? 'Update Program' : 'Create Program'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)} aria-label="Cancel">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading programs...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="card text-center py-12 text-gray-400">
              <FileText className="mx-auto mb-2" size={32} />
              <p>No programs configured yet. Create your first intervention program.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecords.map(r => (
                <div key={r.id} className="card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${r.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <div>
                        <span className="font-semibold text-primary">{r.name}</span>
                        {r.category && <span className="ml-2 text-xs text-gray-400">| {r.category}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.legalBasis && (
                        <span className="text-xs text-gray-500 hidden md:inline">{r.legalBasis}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {r.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                    {r.waitingPeriodDays != null && <span>Wait: {r.waitingPeriodDays}d</span>}
                    {r.requiredDocuments?.length ? <span>Docs: {r.requiredDocuments.length}</span> : null}
                    {r.fundSources?.length ? <span>Funds: {r.fundSources.join(', ')}</span> : null}
                    {r.approvalWorkflow?.length ? <span>Steps: {r.approvalWorkflow.length}</span> : null}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      className="btn-text btn-text-sm"
                      aria-label="View details"
                    >
                      {expandedId === r.id ? <ChevronUp size={14} className="inline" /> : <ChevronDown size={14} className="inline" />}
                      {' '}{expandedId === r.id ? 'Collapse' : 'Details'}
                    </button>
                    <button onClick={() => openEdit(r)} className="btn-text btn-text-sm" aria-label="Edit">Edit</button>
                    <button onClick={() => handleDelete(r.id)} className="btn-text btn-text-sm text-red-600" aria-label="Delete">Delete</button>
                  </div>
                  {expandedId === r.id && (
                    <div className="mt-4 border-t border-gray-100 pt-4 text-sm space-y-3">
                      <Section label="Category" value={r.category} />
                      <Section label="Legal Basis" value={r.legalBasis} />
                      <Section label="Waiting Period" value={r.waitingPeriodDays != null ? `${r.waitingPeriodDays} days` : undefined} />
                      <Section label="Required Documents" value={r.requiredDocuments?.join(', ')} />
                      <Section label="Fund Sources" value={r.fundSources?.join(', ')} />
                      <Section label="Form Version" value={String(r.formVersion)} />
                      {r.approvalWorkflow && r.approvalWorkflow.length > 0 && (
                        <div>
                          <span className="text-xs font-semibold text-gray-500">Approval Workflow</span>
                          <div className="mt-1 space-y-1">
                            {r.approvalWorkflow.map((s, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs text-gray-700">
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold">
                                  {s.order + 1}
                                </span>
                                <span className="font-medium">{s.stepName}</span>
                                <span className="text-gray-400">→</span>
                                <span>{s.approverRole}</span>
                                <span className="text-gray-400">({s.slaDays}d SLA)</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <Section label="Form Template" value={r.formTemplate ? 'Configured' : 'None'} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== ASSIGNMENTS TAB ===== */}
      {activeTab === 'assignments' && (
        <>
          <div className="toolbar">
            <div className="toolbar-left">
              <div className="flex items-center gap-2">
                <select
                  className="form-input text-sm"
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
            </div>
            <div className="toolbar-right">
              <input
                type="text"
                placeholder="Search by case ID..."
                className="form-input max-w-xs"
                value={caseSearch}
                onChange={e => setCaseSearch(e.target.value)}
                aria-label="Search assignments by case ID"
              />
            </div>
          </div>

          {assignLoading ? (
            <div className="text-center py-8 text-gray-400">Loading assignments...</div>
          ) : filteredAssignments.length === 0 ? (
            <div className="card text-center py-12 text-gray-400">
              <CheckCircle className="mx-auto mb-2" size={32} />
              <p>No program assignments found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAssignments.map(a => {
                const badge = getStatusBadge(a.status);
                return (
                  <div key={a.id} className="card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(a.status)}
                        <div>
                          <span className="font-semibold text-primary">{a.programName || 'Program'}</span>
                          <span className="ml-2 text-xs text-gray-400">Case: {a.caseId.slice(0, 8)}...</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${badge.cls}`}>
                          {badge.label}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(a.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                      <span>Worker: {a.assignedWorkerId?.slice(0, 8)}...</span>
                      {a.currentStepOrder > 0 && <span>Current Step: {a.currentStepOrder + 1}</span>}
                    </div>
                    <div className="mt-3">
                      <button
                        onClick={() => handleExpandAssignment(a.id)}
                        className="btn-text btn-text-sm"
                        aria-label="View steps"
                      >
                        {expandedAssignId === a.id ? <ChevronUp size={14} className="inline" /> : <ChevronDown size={14} className="inline" />}
                        {' '}{expandedAssignId === a.id ? 'Hide Steps' : 'View Steps'}
                      </button>
                    </div>

                    {expandedAssignId === a.id && a.steps && (
                      <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
                        <span className="text-xs font-semibold text-gray-500">Approval Steps</span>
                        {a.steps.map((step, i) => {
                          const stepBadge = getStatusBadge(step.status);
                          const canAct = canApproveStep(step);
                          return (
                            <div key={step.id} className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold shrink-0 ${
                                step.status === 'approved' ? 'bg-green-500' :
                                step.status === 'rejected' ? 'bg-red-500' :
                                'bg-gray-400'
                              }`}>
                                {i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium text-gray-800">{step.stepName}</span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${stepBadge.cls}`}>
                                    {stepBadge.label}
                                  </span>
                                  <span className="text-xs text-gray-400">({step.approverRole})</span>
                                </div>
                                {step.remarks && (
                                  <p className="mt-1 text-xs text-gray-500 italic">
                                    {step.status === 'rejected' ? 'Reason: ' : 'Note: '}
                                    {step.remarks}
                                  </p>
                                )}
                                {step.approvedBy && (
                                  <p className="mt-0.5 text-xs text-gray-400">
                                    {step.status === 'approved' ? 'Approved' : 'Processed'} by {step.approvedBy}
                                    {step.approvedAt ? ` on ${new Date(step.approvedAt).toLocaleDateString()}` : ''}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {canAct && (
                                  <>
                                    <button
                                      onClick={() => handleApproveStep(a.id, step.stepOrder)}
                                      className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                                      aria-label={`Approve step ${i + 1}`}
                                      title="Approve"
                                    >
                                      <CheckCircle size={14} />
                                    </button>
                                    <button
                                      onClick={() => openRejectModal(a.id, step.stepOrder, step.stepName)}
                                      className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                                      aria-label={`Reject step ${i + 1}`}
                                      title="Reject"
                                    >
                                      <XCircle size={14} />
                                    </button>
                                  </>
                                )}
                                {user?.role === 'admin' && step.status === 'pending' && (
                                  <button
                                    onClick={() => openOverrideModal(a.id, step.stepOrder, step.stepName)}
                                    className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                                    aria-label={`Override step ${i + 1}`}
                                    title="Admin Override"
                                  >
                                    <Shield size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Reject Modal */}
          {rejectModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setRejectModal(null)}>
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                <h3 className="font-semibold mb-4">Reject Step: {rejectModal.stepName}</h3>
                <div className="form-group mb-4">
                  <label className="form-label">Reason for rejection *</label>
                  <textarea
                    className="form-input min-h-[80px]"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Explain why this step is being rejected..."
                    aria-label="Rejection reason"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setRejectModal(null)}
                    aria-label="Cancel rejection"
                  >
                    Cancel
                  </button>
                  <button
                    className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    disabled={!rejectReason.trim()}
                    onClick={handleConfirmReject}
                    aria-label="Confirm rejection"
                  >
                    Reject Step
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Override Modal */}
          {overrideModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOverrideModal(null)}>
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                <h3 className="font-semibold mb-4">Admin Override: {overrideModal.stepName}</h3>
                <div className="form-group mb-4">
                  <label className="form-label">Override Status</label>
                  <select
                    className="form-input"
                    value={overrideStatus}
                    onChange={e => setOverrideStatus(e.target.value as 'approved' | 'rejected')}
                    aria-label="Override status"
                  >
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="form-group mb-4">
                  <label className="form-label">Reason *</label>
                  <textarea
                    className="form-input min-h-[80px]"
                    value={overrideReason}
                    onChange={e => setOverrideReason(e.target.value)}
                    placeholder="Explain the override reason..."
                    aria-label="Override reason"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setOverrideModal(null)}
                    aria-label="Cancel override"
                  >
                    Cancel
                  </button>
                  <button
                    className="btn bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
                    disabled={!overrideReason.trim()}
                    onClick={handleConfirmOverride}
                    aria-label="Confirm override"
                  >
                    Apply Override
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}

const Section = React.memo(function Section({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <p className="text-gray-700 whitespace-pre-wrap">{value}</p>
    </div>
  );
});
