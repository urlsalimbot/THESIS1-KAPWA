import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, Unlock, Download, FileJson, Shield, User, Hash, Calendar, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { api, exportIrfPdf } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import VictimNarrationField from '../components/irf/VictimNarrationField';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const DISPOSITION_STATES = ['Under Investigation', 'Referred to PNP', 'Referred to WCPD', 'Dismissed', 'Closed'];

const DISPOSITION_COLORS: Record<string, string> = {
  'Under Investigation': 'bg-amber-100 text-amber-800 border-amber-300',
  'Referred to PNP': 'bg-blue-100 text-blue-800 border-blue-300',
  'Referred to WCPD': 'bg-violet-100 text-violet-800 border-violet-300',
  'Dismissed': 'bg-red-100 text-red-800 border-red-300',
  'Closed': 'bg-green-100 text-green-800 border-green-300',
};

const LEGAL_BASIS_OPTIONS = [
  { value: 'court-order', label: 'Court Order' },
  { value: 'subpoena', label: 'Subpoena' },
  { value: 'data-subject-consent', label: 'Written Consent of Data Subject' },
  { value: 'official-investigation', label: 'Official Investigation (DPA)' },
  { value: 'inter-agency-referral', label: 'Inter-Agency Referral' },
  { value: 'foi-request', label: 'Freedom of Information Request' },
  { value: 'supervisory-review', label: 'Supervisory Review' },
  { value: 'data-privacy-complaint', label: 'Data Privacy Complaint' },
];

function LegalBasisFields({
  value, onChange, referenceNumber, onReferenceChange,
}: {
  value: string; onChange: (v: string) => void;
  referenceNumber: string; onReferenceChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Legal Basis</label>
        <select value={value} onChange={e => onChange(e.target.value)} aria-label="Legal basis"
          className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-w-[180px]">
          <option value="">Select legal basis...</option>
          {LEGAL_BASIS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Reference No.</label>
        <Input placeholder="Optional ref #" value={referenceNumber}
          onChange={e => onReferenceChange(e.target.value)} aria-label="Reference number"
          className="h-9 w-36" />
      </div>
    </div>
  );
}

function composeLegalBasis(basis: string, ref: string): string {
  return basis + (ref ? ` — Ref: ${ref}` : '');
}

function PersonDetailCard({ title, data, icon, redacted }: { title: string; data: Record<string, any> | null; icon: React.ReactNode; redacted?: boolean }) {
  if (!data && !redacted) return null;

  if (redacted) {
    return (
      <div className="rounded-lg border bg-card h-full">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">{icon}</span>
            <h2 className="text-sm font-semibold">{title}</h2>
          </div>
          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
            <EyeOff size={10} /> Redacted
          </span>
        </div>
        <Separator />
        <div className="px-4 py-8 flex flex-col items-center justify-center text-muted-foreground gap-2">
          <EyeOff size={20} className="opacity-40" />
          <p className="text-xs">Person details are protected</p>
          <p className="text-[10px] opacity-60">Provide legal basis to unlock</p>
        </div>
      </div>
    );
  }

  const labels: Record<string, string> = {
    name: 'Full Name', surname: 'Surname', firstName: 'First Name',
    middleName: 'Middle Name', phone: 'Contact No.', address: 'Address',
    age: 'Age', age_est: 'Age (est.)', relationship: 'Relationship',
    occupation: 'Occupation', barangay: 'Barangay', city: 'City/Municipality',
    province: 'Province', sex: 'Sex', birthday: 'Birthday',
    civilStatus: 'Civil Status', education: 'Education',
  };

  const priority = ['name', 'middleName', 'phone', 'address', 'age', 'age_est', 'relationship', 'occupation', 'barangay', 'city', 'province', 'sex', 'birthday', 'civilStatus', 'education'];
  const entries = Object.entries(data)
    .filter(([k]) => !['createdAt', 'updatedAt', 'id', 'irfId'].includes(k))
    .filter(([_, v]) => String(v ?? '') !== '[REDACTED]');
  const sorted = entries.sort((a, b) => {
    const ia = priority.indexOf(a[0]), ib = priority.indexOf(b[0]);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  return (
    <div className="rounded-lg border bg-card h-full">
      <div className="px-4 py-3 flex items-center gap-3">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <Separator />
      <div className="px-4 py-3 space-y-2 text-sm">
        {sorted.length === 0 ? (
          <p className="text-muted-foreground text-xs">No details available</p>
        ) : sorted.map(([key, val]) => (
          <div key={key}>
            <span className="text-muted-foreground text-xs">{labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span>
            <p className="font-medium">{typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IrfDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [irf, setIrf] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [decryptedNarration, setDecryptedNarration] = useState<string | null>(null);
  const [legalBasis, setLegalBasis] = useState('');
  const [legalBasisRef, setLegalBasisRef] = useState('');
  const [showDecryptForm, setShowDecryptForm] = useState(false);
  const [namesRedacted, setNamesRedacted] = useState(false);
  const [unmaskedData, setUnmaskedData] = useState<{ itemA?: any; itemB?: any } | null>(null);
  const [exportLegalBasis, setExportLegalBasis] = useState('');
  const [exportLegalBasisRef, setExportLegalBasisRef] = useState('');
  const [exportPassword, setExportPassword] = useState('');

  useEffect(() => {
    if (id) load();
  }, [id]);

  function hasRedactedFields(obj: any) {
    return obj && typeof obj === 'object' && Object.values(obj).some(v => String(v ?? '') === '[REDACTED]');
  }

  async function load() {
    if (!id) return;
    try {
      const data = await api.get<any>(`/irf/${id}`);
      const redactedA = hasRedactedFields(data.itemAReportingPerson);
      const redactedB = hasRedactedFields(data.itemBPersonReported);
      setNamesRedacted(redactedA || redactedB);
      if (redactedA) data.itemAReportingPerson = null;
      if (redactedB) data.itemBPersonReported = null;
      setIrf(data);
    } catch (e) {
      console.error('Failed to load IRF:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisposition(action: () => Promise<any>) {
    try {
      await action();
      await load();
    } catch (e) {
      toast.error('Transition failed — ensure you have the correct role');
    }
  }

  async function handleDecrypt() {
    const basis = composeLegalBasis(legalBasis, legalBasisRef);
    if (!id || !legalBasis) return;
    try {
      const result = await api.post<{ narration: string }>(`/irf/${id}/decrypt`, { legalBasis: basis });
      setDecryptedNarration(result.narration);
      setShowDecryptForm(false);
    } catch (e) {
      toast.error('Decryption failed — verify legal basis');
    }
  }

  async function handleUnmaskNames() {
    if (!id || !legalBasis) return;
    const basis = composeLegalBasis(legalBasis, legalBasisRef);
    try {
      const data = await api.get<{ itemAPersonReported?: any; itemBPersonReported?: any }>(`/irf/${id}/unmask-names?legalBasis=${encodeURIComponent(basis)}`);
      setUnmaskedData({ itemA: data.itemAPersonReported, itemB: data.itemBPersonReported });
    } catch (e) {
      toast.error('Unlock failed — verify legal basis');
    }
  }

  async function handleExportPdf() {
    const basis = composeLegalBasis(exportLegalBasis, exportLegalBasisRef);
    if (!id || !exportLegalBasis) return;
    try {
      await exportIrfPdf(id, basis, exportPassword || 'default');
    } catch (e) {
      toast.error('PDF export failed');
    }
  }

  async function handleExportJson() {
    const basis = composeLegalBasis(exportLegalBasis, exportLegalBasisRef);
    if (!id || !exportLegalBasis) return;
    try {
      const data = await api.get<any>(`/irf/${id}/export-json?legalBasis=${encodeURIComponent(basis)}`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `IRF-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('JSON export failed');
    }
  }

  if (loading) return (
    <PageShell title="Loading..." description="">
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading IRF details...</div>
    </PageShell>
  );

  if (!irf) return (
    <PageShell title="Not Found" description="" backTo={{ label: 'IRF List', onClick: () => navigate('/irf') }}>
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <FileJson size={40} className="mb-3 opacity-30" />
        <p className="text-sm">IRF case not found.</p>
      </div>
    </PageShell>
  );

  const dispositionIndex = DISPOSITION_STATES.indexOf(irf.caseDisposition);
  const currentState = irf.caseDisposition;

  const personA = unmaskedData?.itemA || irf.itemAReportingPerson;
  const personB = unmaskedData?.itemB || irf.itemBPersonReported;
  const showRedacted = namesRedacted && !unmaskedData;

  function SectionHeader({ title, icon, action }: { title: string; icon?: React.ReactNode; action?: React.ReactNode }) {
    return (
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        {action}
      </div>
    );
  }

  return (
    <PageShell title={`IRF: ${irf.blotterEntryNumber}`}
      description={`Blotter: ${irf.blotterEntryNumber} · ${irf.caseCategory}`}
      backTo={{ label: 'IRF List', onClick: () => navigate(-1) }}
      actions={
        <Badge variant={currentState === 'Closed' ? 'default' : 'secondary'}
          className={DISPOSITION_COLORS[currentState] || ''}>
          {currentState}
        </Badge>
      }>

      {/* Layout: 2/3 main content + 1/3 sidebar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">

        {/* Main content — 2/3 width */}
        <div className="md:col-span-2 space-y-4">

          {/* Unmask banner */}
          {showRedacted && (
            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-4 py-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2 text-amber-700 shrink-0">
                  <EyeOff size={16} />
                  <span className="text-sm font-medium">Person details redacted</span>
                  <span className="text-xs text-amber-500">— select legal basis &amp; ref # to unlock both persons</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 ml-auto">
                  <LegalBasisFields value={legalBasis} onChange={setLegalBasis}
                    referenceNumber={legalBasisRef} onReferenceChange={setLegalBasisRef} />
                  <Button size="sm" variant="outline" onClick={handleUnmaskNames}
                    disabled={!legalBasis} className="self-end">
                    <Eye size={14} className="mr-1" /> Unlock Names
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Person cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PersonDetailCard title="Reporting Person" data={personA} icon={<User size={16} />} redacted={showRedacted} />
            <PersonDetailCard title="Person Reported" data={personB} icon={<Shield size={16} />} redacted={showRedacted} />
          </div>

          {/* Narration */}
          <div className="rounded-lg border bg-card">
            <SectionHeader title="Victim Narration" icon={<Lock size={16} />} />
            <Separator />
            <div className="px-4 py-4">
              {decryptedNarration ? (
                <VictimNarrationField value={decryptedNarration} readOnly isEncrypted={false} />
              ) : irf.encryptedNarration ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    <Lock size={14} />
                    <span className="font-medium">AES-256 Encrypted</span>
                    <span className="text-amber-500">— legal basis required to decrypt</span>
                  </div>
                  {showDecryptForm ? (
                    <div className="space-y-3">
                      <LegalBasisFields value={legalBasis} onChange={setLegalBasis}
                        referenceNumber={legalBasisRef} onReferenceChange={setLegalBasisRef} />
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={handleDecrypt} disabled={!legalBasis}>
                          <Unlock size={14} className="mr-1" /> Decrypt
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowDecryptForm(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setShowDecryptForm(true)}>
                      <Eye size={14} className="mr-1" /> Decrypt Narration
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No narration recorded</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar — 1/3 width */}
        <div className="space-y-4">

          {/* Case Info */}
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 flex items-center gap-3">
              <Calendar size={16} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold">Case Info</h2>
            </div>
            <Separator />
            <div className="px-4 py-3 space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Blotter Number</span>
                <p className="font-medium">{irf.blotterEntryNumber}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Category</span>
                <p className="font-medium">{irf.caseCategory}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Reported</span>
                <p className="font-medium">{irf.datetimeReported ? new Date(irf.datetimeReported).toLocaleDateString() : '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Incident</span>
                <p className="font-medium">{irf.datetimeIncident ? new Date(irf.datetimeIncident).toLocaleDateString() : '—'}</p>
              </div>
              {irf.dismissalReason && (
                <>
                  <Separator />
                  <div>
                    <span className="text-muted-foreground text-xs">Dismissal Reason</span>
                    <p className="font-medium text-amber-700">{irf.dismissalReason}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Disposition */}
          <div className="rounded-lg border bg-card">
            <SectionHeader title="Case Disposition" icon={<Hash size={16} />} />
            <Separator />
            <div className="px-4 py-4">
              <div className="flex items-start gap-0 overflow-x-auto pb-2">
                {DISPOSITION_STATES.map((state, i) => {
                  const isPast = i <= dispositionIndex;
                  const isCurrent = state === currentState;
                  return (
                    <div key={state} className="flex items-center shrink-0">
                      <div className="flex flex-col items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2
                          ${isCurrent ? 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/30'
                            : isPast ? 'bg-green-500 text-white border-green-500'
                            : 'bg-muted text-muted-foreground border-border'}`}>
                          {isPast && !isCurrent ? '✓' : i + 1}
                        </div>
                        <span className={`text-xs font-medium whitespace-nowrap px-2 py-0.5 rounded
                          ${isCurrent ? 'bg-primary/10 text-primary font-semibold'
                            : isPast ? 'text-green-700'
                            : 'text-muted-foreground'}`}>
                          {state}
                        </span>
                      </div>
                      {i < DISPOSITION_STATES.length - 1 && (
                        <div className={`w-8 md:w-10 h-0.5 mx-1 mt-[-1.25rem]
                          ${isPast && !isCurrent ? 'bg-green-400' : isCurrent ? 'bg-primary/40' : 'bg-border'}`} />
                      )}
                    </div>
                  );
                })}
              </div>

              <Separator className="my-4" />

              {currentState === 'Under Investigation' && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleDisposition(() => api.patch(`/irf/${id}/refer-pnp`))}>
                    Refer to PNP
                  </Button>
                  <Button size="sm" variant="secondary"
                    onClick={() => handleDisposition(() => api.patch(`/irf/${id}/refer-wcpd`))}>
                    Refer to WCPD
                  </Button>
                  <Button size="sm" variant="outline"
                    onClick={() => {
                      const reason = prompt('Dismissal reason:');
                      if (reason) handleDisposition(() => api.patch(`/irf/${id}/dismiss`, { reason }));
                    }}
                    className="text-destructive border-destructive/30 hover:bg-destructive/10">
                    Dismiss
                  </Button>
                </div>
              )}
              {(currentState === 'Referred to PNP' || currentState === 'Referred to WCPD' || currentState === 'Dismissed') && (
                <Button size="sm"
                  onClick={() => handleDisposition(() => api.patch(`/irf/${id}/close`))}>
                  Close Case
                </Button>
              )}
            </div>
          </div>

          {/* Export */}
          <div className="rounded-lg border bg-card">
            <SectionHeader title="Export" icon={<Download size={16} />} />
            <Separator />
            <div className="px-4 py-4 space-y-3">
              <LegalBasisFields value={exportLegalBasis} onChange={setExportLegalBasis}
                referenceNumber={exportLegalBasisRef} onReferenceChange={setExportLegalBasisRef} />
              <div className="flex items-end gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">PDF Password</label>
                  <Input placeholder="Optional" value={exportPassword}
                    onChange={e => setExportPassword(e.target.value)}
                    type="password" aria-label="PDF password" className="h-9" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleExportPdf} disabled={!exportLegalBasis}>
                    <FileJson size={14} className="mr-1" /> PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleExportJson} disabled={!exportLegalBasis}>
                    <Download size={14} className="mr-1" /> JSON
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
