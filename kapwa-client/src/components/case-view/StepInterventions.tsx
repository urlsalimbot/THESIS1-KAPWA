import { useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Calendar, DollarSign } from 'lucide-react';
import { SERVICE_TYPES, NATURE_OF_SERVICE } from '@/lib/constants';

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
}

interface StepInterventionsProps {
  caseId: string;
}

export function StepInterventions({ caseId }: StepInterventionsProps) {
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

  const totalAmount = interventions.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-lg border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Intervention Record</h3>
            <p className="text-xs text-muted-foreground">
              {interventions.length} intervention{interventions.length !== 1 ? 's' : ''} delivered
              {totalAmount > 0 && ` · ₱${totalAmount.toLocaleString()} total`}
            </p>
          </div>
          <Button size="sm" onClick={() => setAdding(!adding)}>
            <Plus size={14} className="mr-1" /> Add Intervention
          </Button>
        </div>
      </div>

      {/* Add Form */}
      {adding && (
        <div className="rounded-lg border bg-card px-4 py-3 space-y-3">
          <h4 className="text-sm font-medium">New Intervention</h4>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Program / Service *</label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.programId}
              onChange={e => setForm(f => ({ ...f, programId: e.target.value }))}
            >
              <option value="">— Select a program —</option>
              {programs.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <optgroup label="Other Services">
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
              <label className="text-sm font-medium">Service Name *</label>
              <Input
                value={form.serviceName}
                onChange={e => setForm(f => ({ ...f, serviceName: e.target.value }))}
                placeholder="e.g., Counseling Session, Home Visit"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Delivery Date</label>
              <Input type="date" value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Amount (₱)</label>
              <Input type="text" inputMode="numeric" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value.replace(/,/g, '') }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mode of Delivery</label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.modeOfDelivery} onChange={e => setForm(f => ({ ...f, modeOfDelivery: e.target.value }))}>
                <option value="">—</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Guarantee Letter">Guarantee Letter</option>
                <option value="In-kind">In-kind</option>
                <option value="Service">Service</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Fund Source</label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.fundSource} onChange={e => setForm(f => ({ ...f, fundSource: e.target.value }))}>
                <option value="">—</option>
                <option value="DSWD">DSWD</option>
                <option value="LGU">LGU</option>
                <option value="PDAF">PDAF</option>
                <option value="Donation">Donation</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Additional details about this intervention..."
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleAdd} disabled={saving || (!form.programId && !form.serviceName)}>
              {saving ? 'Saving...' : 'Save Intervention'}
            </Button>
            <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Intervention List */}
      {interventions.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No interventions recorded yet. Click "Add Intervention" to document delivered services.
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
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(intv.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
