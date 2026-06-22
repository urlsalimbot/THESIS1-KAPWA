import React, { useState, useEffect } from 'react';
import { FileText, Plus, ChevronDown, ChevronUp, X } from 'lucide-react';
import { getPrograms, createProgram, updateProgram, deleteProgram } from '../lib/api';
import JsonSchemaForm from '../components/forms/JsonSchemaForm';
import '../index.css';

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

export function ProgramsPage() {
  const [records, setRecords] = useState<ProgramRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProgramForm>(emptyForm);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [msg, setMsg] = useState('');
  const [jsonError, setJsonError] = useState('');

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, []);

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

  const filtereRecords = records.filter(r =>
    !searchTerm ||
    r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const parsedFormTemplate = parseJsonTemplate(form.formTemplate);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Programs</h2>
          <p className="page-desc">Configure dynamic intervention programs — MSWDO Norzagaray</p>
        </div>
      </div>

      {msg && (
        <div className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {msg}
        </div>
      )}

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
              <h4 className="mb-3 text-sm font-semibold text-[#2E5C8A]">Basic Information</h4>
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
                    className="rounded border-gray-300 text-[#2E5C8A]"
                    aria-label="Active"
                  />
                  Active
                </label>
              </div>
            </div>

            {/* Required Documents */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-[#2E5C8A]">Required Documents</h4>
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
              <h4 className="mb-3 text-sm font-semibold text-[#2E5C8A]">Fund Sources</h4>
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
              <h4 className="mb-3 text-sm font-semibold text-[#2E5C8A]">Approval Workflow</h4>
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
              <h4 className="mb-3 text-sm font-semibold text-[#2E5C8A]">Form Template (JSON Schema)</h4>
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
      ) : filtereRecords.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <FileText className="mx-auto mb-2" size={32} />
          <p>No programs configured yet. Create your first intervention program.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtereRecords.map(r => (
            <div key={r.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${r.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <span className="font-semibold text-[#2E5C8A]">{r.name}</span>
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
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#2E5C8A] text-white text-[10px] font-bold">
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
    </div>
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
