import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { api } from '../lib/api';
import JsonSchemaForm from '../components/forms/JsonSchemaForm';
import { PageShell } from '@/components/PageShell';
import { toast } from 'sonner';

interface ApprovalStep {
  stepName: string;
  approverRole: string;
  slaDays: number;
  order: number;
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

export function CreateProgramPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<ProgramForm>(emptyForm);
  const [jsonError, setJsonError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateForm(field: keyof ProgramForm, value: any) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function addRequiredDoc() { setForm(prev => ({ ...prev, requiredDocuments: [...prev.requiredDocuments, ''] })); }
  function removeRequiredDoc(i: number) {
    setForm(prev => ({ ...prev, requiredDocuments: prev.requiredDocuments.filter((_, idx) => idx !== i) }));
  }
  function updateRequiredDoc(i: number, val: string) {
    setForm(prev => {
      const docs = [...prev.requiredDocuments];
      docs[i] = val;
      return { ...prev, requiredDocuments: docs };
    });
  }

  function addFundSource() { setForm(prev => ({ ...prev, fundSources: [...prev.fundSources, ''] })); }
  function removeFundSource(i: number) {
    setForm(prev => ({ ...prev, fundSources: prev.fundSources.filter((_, idx) => idx !== i) }));
  }
  function updateFundSource(i: number, val: string) {
    setForm(prev => {
      const srcs = [...prev.fundSources];
      srcs[i] = val;
      return { ...prev, fundSources: srcs };
    });
  }

  function addWorkflowStep() {
    setForm(prev => ({
      ...prev,
      approvalWorkflow: [...prev.approvalWorkflow, { stepName: '', approverRole: '', slaDays: 1, order: prev.approvalWorkflow.length }],
    }));
  }
  function removeWorkflowStep(i: number) {
    setForm(prev => ({
      ...prev,
      approvalWorkflow: prev.approvalWorkflow.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx })),
    }));
  }
  function updateWorkflowStep(i: number, field: string, value: any) {
    setForm(prev => {
      const steps = [...prev.approvalWorkflow];
      steps[i] = { ...steps[i], [field]: value };
      return { ...prev, approvalWorkflow: steps };
    });
  }

  const parsedFormTemplate = form.formTemplate.trim() ? (() => {
    try { return JSON.parse(form.formTemplate); } catch { return null; }
  })() : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setJsonError('');
    if (form.formTemplate.trim()) {
      try {
        JSON.parse(form.formTemplate);
      } catch {
        setJsonError('Invalid JSON in Form Template');
        return;
      }
    }
    setSubmitting(true);
    try {
      await api.post('/programs', {
        name: form.name,
        category: form.category || undefined,
        waitingPeriodDays: form.waitingPeriodDays ? parseInt(form.waitingPeriodDays) : undefined,
        legalBasis: form.legalBasis || undefined,
        requiredDocuments: form.requiredDocuments.filter(Boolean),
        fundSources: form.fundSources.filter(Boolean),
        approvalWorkflow: form.approvalWorkflow,
        formTemplate: parsedFormTemplate,
        isActive: form.isActive,
      });
      toast.success('Program created successfully');
      navigate('/programs');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create program');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell
      title="New Program"
      description="Configure a new intervention program with workflow and documents"
      backTo={{ label: 'Programs', onClick: () => navigate('/programs') }}
    >
      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
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
            placeholder='Paste JSON Schema here, e.g. {"type":"object","properties":{"field1":{"type":"string"}}}'
            aria-label="Form Template JSON"
          />
          {jsonError && <p className="mt-1 text-xs text-red-500">{jsonError}</p>}

          {parsedFormTemplate && parsedFormTemplate.type === 'object' && (
            <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-3">
              <p className="mb-2 text-xs font-semibold text-blue-700">Form Preview</p>
              <JsonSchemaForm schema={parsedFormTemplate as any} readOnly />
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={submitting} aria-label="Create Program">
            {submitting ? 'Creating...' : 'Create Program'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/programs')} aria-label="Cancel">
            Cancel
          </button>
        </div>
      </form>
    </PageShell>
  );
}
