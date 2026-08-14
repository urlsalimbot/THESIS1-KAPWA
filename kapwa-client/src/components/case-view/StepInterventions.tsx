import { useState, useRef } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { api, downloadFilingDoc } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Calendar, DollarSign, FileCheck, CheckCircle2, Circle, FileText, Upload, Download, X } from 'lucide-react';
import { SERVICE_TYPES, NATURE_OF_SERVICE } from '@/lib/constants';
import { useTranslation } from 'react-i18next';

interface Intervention {
  id: string;
  caseId: string;
  programId?: string;
  serviceName: string;
  category?: string;
  deliveryDate?: string;
  amount?: number;
  modeOfDelivery?: string;
  fundSource?: string;
  notes?: string;
  deliveredBy?: string;
}

interface Program {
  id: string;
  name: string;
  category?: string;
  requiredDocuments?: string[];
}

interface StepInterventionsProps {
  caseId: string;
  caseData: any;
  userRole?: string;
  readOnly?: boolean;
}

export function StepInterventions({ caseId, caseData, userRole, readOnly = false }: StepInterventionsProps) {
  const { t } = useTranslation();
  const { mutate: globalMutate } = useSWRConfig();
  const { data: interventions = [], mutate } = useSWR<Intervention[]>(
    queryKeys.cases.interventions(caseId),
  );
  const { data: programs = [] } = useSWR<Program[]>(queryKeys.programs.list());

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    programId: '',
    serviceName: '',
    category: '',
    deliveryDate: '',
    amount: '',
    modeOfDelivery: '',
    fundSource: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [savingReqs, setSavingReqs] = useState(false);

  const checklist = (caseData?.requirementsChecklist || {}) as Record<string, boolean>;

  const programIds = [...new Set(interventions.map(i => i.programId).filter(Boolean))];
  const allRequirements = programs
    .filter(p => programIds.includes(p.id) && p.requiredDocuments?.length)
    .flatMap(p => p.requiredDocuments!)
    .filter((v, i, a) => a.indexOf(v) === i);

  const { data: docs = [] } = useSWR<any[]>(
    caseId && allRequirements.length > 0 ? `/filing?caseId=${caseId}` : null,
  );
  const docsByRequirement: Record<string, any[]> = {};
  for (const d of docs) {
    const k = d.requirementKey || '__uncategorized__';
    if (!docsByRequirement[k]) docsByRequirement[k] = [];
    docsByRequirement[k].push(d);
  }

  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const canUpload = userRole && ['admin', 'social_worker', 'coordinator', 'claimant'].includes(userRole) && !readOnly;

  async function handleAdd() {
    setSaving(true);
    try {
      const selectedProgram = programs.find(p => p.id === form.programId);
      const serviceName = selectedProgram?.name || form.serviceName;
      const category = selectedProgram?.category || form.category || undefined;
      await api.post(`/cases/${caseId}/interventions`, {
        programId: form.programId || null,
        serviceName,
        category,
        deliveryDate: form.deliveryDate || null,
        amount: form.amount ? parseFloat(form.amount) : null,
        modeOfDelivery: form.modeOfDelivery || null,
        fundSource: form.fundSource || null,
        notes: form.notes || null,
      });
      await mutate();
      setAdding(false);
      setForm({ programId: '', serviceName: '', category: '', deliveryDate: '', amount: '', modeOfDelivery: '', fundSource: '', notes: '' });
    } catch (e) {
      console.error('Failed to add intervention:', e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.del(`/cases/${caseId}/interventions/${id}`);
      await mutate();
    } catch (e) {
      console.error('Failed to delete intervention:', e);
    }
  }

  async function toggleRequirement(key: string) {
    const updated = { ...checklist, [key]: !checklist[key] };
    setSavingReqs(true);
    try {
      await api.patch(`/cases/${caseId}/requirements`, { requirementsChecklist: updated });
      await globalMutate(queryKeys.cases.detail(caseId));
    } catch (e) {
      console.error('Failed to update requirements:', e);
    } finally {
      setSavingReqs(false);
    }
  }

  async function handleUpload(key: string, file: File) {
    if (!file) return;
    setUploading(key);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('caseId', caseId);
      form.append('requirementKey', key);
      await api.upload('/filing/upload', form);
      await globalMutate(`/filing?caseId=${caseId}`);
    } catch (e) {
      console.error('Upload failed:', e);
    } finally {
      setUploading(null);
    }
  }

  const totalAmount = interventions.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const completedCount = allRequirements.filter(r => checklist[r]).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-lg border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">{t('caseView.implement.interventionRecord', 'Intervention Record')}</h3>
            <p className="text-xs text-muted-foreground">
              {interventions.length} {t('caseView.implement.interventionUnit', { count: interventions.length, defaultValue: interventions.length !== 1 ? 'interventions' : 'intervention' })} {t('caseView.implement.delivered', 'delivered')}
              {totalAmount > 0 && ` · ₱${totalAmount.toLocaleString()} ${t('caseView.implement.total', 'total')}`}
            </p>
          </div>
          <Button size="sm" onClick={() => setAdding(!adding)} disabled={readOnly}>
            <Plus size={14} className="mr-1" /> {t('caseView.implement.addIntervention', 'Add Intervention')}
          </Button>
        </div>
      </div>

      {/* Add Form */}
      {adding && (
        <div className="rounded-lg border bg-card px-4 py-3 space-y-3">
          <h4 className="text-sm font-medium">{t('caseView.implement.newIntervention', 'New Intervention')}</h4>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('caseView.implement.programService', 'Program / Service *')}</label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.programId}
              onChange={e => setForm(f => ({ ...f, programId: e.target.value }))}
            >
              <option value="">{t('caseView.implement.selectProgram', '— Select a program —')}</option>
              {programs.map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.requiredDocuments?.length ? ` (${p.requiredDocuments.length} ${t('caseView.implement.req', 'req.')})` : ''}</option>
              ))}
              <optgroup label={t('caseView.implement.otherServices', 'Other Services')}>
                {SERVICE_TYPES.map(s => (
                  <option key={s} value={`adhoc:${s}`}>{s}</option>
                ))}
                {NATURE_OF_SERVICE.map(s => (
                  <option key={s} value={`adhoc:${s}`}>{s}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {form.programId.startsWith('adhoc:') && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('caseView.implement.serviceName', 'Service Name *')}</label>
              <Input
                value={form.serviceName}
                onChange={e => setForm(f => ({ ...f, serviceName: e.target.value }))}
                placeholder={t('caseView.implement.serviceNamePlaceholder', 'e.g., Counseling Session, Home Visit')}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('caseView.implement.deliveryDate', 'Delivery Date')}</label>
              <Input type="date" value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('caseView.implement.amount', 'Amount (₱)')}</label>
              <Input type="text" inputMode="numeric" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value.replace(/,/g, '') }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('caseView.implement.modeOfDeliveryLabel', 'Mode of Delivery')}</label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.modeOfDelivery} onChange={e => setForm(f => ({ ...f, modeOfDelivery: e.target.value }))}>
                <option value="">—</option>
                {[
                  { value: 'Cash', label: t('caseView.implement.modeOfDelivery.cash', 'Cash') },
                  { value: 'Cheque', label: t('caseView.implement.modeOfDelivery.cheque', 'Cheque') },
                  { value: 'Guarantee Letter', label: t('caseView.implement.modeOfDelivery.guaranteeLetter', 'Guarantee Letter') },
                  { value: 'In-kind', label: t('caseView.implement.modeOfDelivery.inKind', 'In-kind') },
                  { value: 'Service', label: t('caseView.implement.modeOfDelivery.service', 'Service') },
                ].map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('caseView.implement.fundSourceLabel', 'Fund Source')}</label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.fundSource} onChange={e => setForm(f => ({ ...f, fundSource: e.target.value }))}>
                <option value="">—</option>
                {[
                  { value: 'DSWD', label: t('caseView.implement.fundSource.dswd', 'DSWD') },
                  { value: 'LGU', label: t('caseView.implement.fundSource.lgu', 'LGU') },
                  { value: 'PDAF', label: t('caseView.implement.fundSource.pdaf', 'PDAF') },
                  { value: 'Donation', label: t('caseView.implement.fundSource.donation', 'Donation') },
                  { value: 'Other', label: t('caseView.implement.fundSource.other', 'Other') },
                ].map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('caseView.implement.notes', 'Notes')}</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder={t('caseView.implement.notesPlaceholder', 'Additional details about this intervention...')}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleAdd} disabled={saving || (!form.programId && !form.serviceName)}>
              {saving ? t('caseView.saving', 'Saving...') : t('caseView.implement.saveIntervention', 'Save Intervention')}
            </Button>
            <Button variant="outline" onClick={() => setAdding(false)}>{t('caseView.cancel', 'Cancel')}</Button>
          </div>
        </div>
      )}

      {/* Intervention List */}
      {interventions.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {t('caseView.implement.noInterventions', 'No interventions recorded yet. Click "Add Intervention" to document delivered services.')}
        </div>
      ) : (
        <div className="space-y-2">
          {interventions.map(intv => (
            <div key={intv.id} className="rounded-lg border bg-card px-4 py-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{intv.serviceName}</span>
                    {intv.category && <Badge variant="secondary" className="text-[10px]">{intv.category}</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {intv.deliveryDate && (
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> {new Date(intv.deliveryDate).toLocaleDateString()}
                      </span>
                    )}
                    {intv.amount && (
                      <span className="flex items-center gap-1">
                        <DollarSign size={12} /> ₱{Number(intv.amount).toLocaleString()}
                      </span>
                    )}
                    {intv.modeOfDelivery && <span>{intv.modeOfDelivery}</span>}
                    {intv.fundSource && <span>{intv.fundSource}</span>}
                  </div>
                  {intv.notes && <p className="text-xs text-muted-foreground/70 mt-1">{intv.notes}</p>}
                </div>
                {!readOnly && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(intv.id)}>
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Requirements Checklist */}
      {allRequirements.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3 flex items-center gap-2">
            <FileCheck size={16} className="text-primary" />
            <h3 className="text-sm font-semibold">{t('caseView.implement.requirements', 'Requirements')}</h3>
            <span className="text-xs text-muted-foreground ml-auto">{completedCount}/{allRequirements.length} {t('caseView.implement.complete', 'complete')}</span>
          </div>
          <Separator />
          <div className="px-4 py-3 space-y-2">
            {allRequirements.map(req => {
              const done = checklist[req];
              const uploadedDocs = docsByRequirement[req] || [];
              return (
                <div key={req} className="border rounded-md overflow-hidden">
                  <div className="flex items-center gap-3 px-3 py-2 hover:bg-muted transition-colors">
                    <button
                      onClick={() => toggleRequirement(req)}
                      disabled={savingReqs}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      {done
                        ? <CheckCircle2 size={18} className="text-primary shrink-0" />
                        : <Circle size={18} className="text-muted-foreground shrink-0" />
                      }
                      <span className={`text-sm ${done ? 'line-through text-muted-foreground' : ''}`}>{req}</span>
                    </button>
                    <div className="flex items-center gap-1">
                      {uploadedDocs.length > 0 && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <FileText size={10} /> {uploadedDocs.length}
                        </Badge>
                      )}
                      {canUpload && (
                        <>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx"
                            className="hidden"
                            ref={el => { fileInputRefs.current[req] = el; }}
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) handleUpload(req, f);
                              e.target.value = '';
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={uploading === req}
                            onClick={() => fileInputRefs.current[req]?.click()}
                          >
                            {uploading === req
                              ? <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              : <Upload size={14} />
                            }
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {uploadedDocs.length > 0 && (
                    <div className="px-3 pb-2 space-y-1">
                      {uploadedDocs.map((doc: any) => (
                        <div key={doc.id} className="flex items-center gap-2 text-xs text-muted-foreground pl-9">
                          <FileText size={10} />
                          <button
                            onClick={() => downloadFilingDoc(doc.id, doc.originalName || 'document').catch(() => alert(t('caseView.documents.downloadFailed', 'Download failed')))}
                            className="hover:underline truncate text-left"
                          >
                            {doc.originalName}
                          </button>
                          <span className="text-[10px]">({(doc.fileSize / 1024).toFixed(0)} KB)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
