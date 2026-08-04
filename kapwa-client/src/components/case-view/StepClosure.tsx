import { useState } from 'react';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useSWRConfig } from 'swr';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { FileText, CheckCircle, Clock, ExternalLink, Download, Lock } from 'lucide-react';
import { downloadCsrPdf } from '@/lib/api';
import SignaturePad from '../forms/SignaturePad';

interface StepClosureProps {
  caseId: string;
  caseData: any;
  readOnly?: boolean;
}

const CLOSURE_OUTCOMES = [
  { value: 'graduated', label: 'Graduated', description: 'Achieved Level 3 self-sufficiency' },
  { value: 'self_sufficient', label: 'Self-Sufficient', description: 'No longer needs assistance' },
  { value: 'referred', label: 'Referred', description: 'Transferred to another program' },
  { value: 'incomplete', label: 'Incomplete', description: 'Client stopped engaging' },
  { value: 'deceased', label: 'Deceased', description: 'Client has passed away' },
];

export function StepClosure({ caseId, caseData, readOnly }: StepClosureProps) {
  const { mutate } = useSWRConfig();
  const [saving, setSaving] = useState(false);

  const [closure, setClosure] = useState({
    closureOutcome: caseData?.closureOutcome || '',
    exitNotes: caseData?.exitNotes || '',
    clientSignature: caseData?.clientSignature || '',
  });

  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/cases/${caseId}/closure`, {
        closureOutcome: closure.closureOutcome || null,
        exitNotes: closure.exitNotes || null,
        clientSignature: closure.clientSignature || null,
      });
      await mutate(queryKeys.cases.detail(caseId));
    } catch (e) {
      console.error('Failed to save closure:', e);
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalClosure() {
    if (!closure.closureOutcome) {
      alert('Please select a closure outcome');
      return;
    }
    if (!closure.clientSignature) {
      alert('Please capture client signature');
      return;
    }
    setSaving(true);
    try {
      // Save closure data first
      await api.patch(`/cases/${caseId}/closure`, {
        closureOutcome: closure.closureOutcome,
        exitNotes: closure.exitNotes || null,
        clientSignature: closure.clientSignature,
      });
      await mutate(queryKeys.cases.detail(caseId));
    } catch (e) {
      console.error('Failed to close case:', e);
    } finally {
      setSaving(false);
    }
  }

  const isClosed = caseData?.status === 'closed';

  return (
    <div className="space-y-4">
      {/* Closure Status */}
      <div className="rounded-lg border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Case Closure</h3>
            {readOnly && <Lock size={14} className="text-muted-foreground" />}
          </div>
          <Badge variant={isClosed ? 'default' : 'outline'} className="text-sm">
            {isClosed ? <CheckCircle size={12} className="mr-1" /> : <Clock size={12} className="mr-1" />}
            {isClosed ? 'Closed' : 'Open'}
          </Badge>
        </div>
      </div>

      {/* Closure Outcome */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold">Closure Outcome *</h3>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-2">
          {CLOSURE_OUTCOMES.map(outcome => (
            <label
              key={outcome.value}
              className={`flex items-start gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                closure.closureOutcome === outcome.value
                  ? 'bg-primary/10 border border-primary'
                  : 'hover:bg-muted border border-transparent'
              }`}
            >
              <input
                type="radio"
                name="closureOutcome"
                value={outcome.value}
                checked={closure.closureOutcome === outcome.value}
                onChange={e => setClosure(c => ({ ...c, closureOutcome: e.target.value }))}
                className="mt-0.5"
                disabled={isClosed || readOnly}
              />
              <div>
                <p className="text-sm font-medium">{outcome.label}</p>
                <p className="text-xs text-muted-foreground">{outcome.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Exit Notes */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold">Exit Notes</h3>
        </div>
        <Separator />
        <div className="px-4 py-3">
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
            value={closure.exitNotes}
            onChange={e => setClosure(c => ({ ...c, exitNotes: e.target.value }))}
            placeholder="Final notes before case closure..."
            disabled={isClosed || readOnly}
          />
        </div>
      </div>

      {/* Client Signature */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold">Client Signature *</h3>
        </div>
        <Separator />
        <div className="px-4 py-3">
          {closure.clientSignature ? (
            <div className="space-y-2">
              <img
                src={closure.clientSignature}
                alt="Client signature"
                className="max-h-20 border rounded bg-white"
              />
              <p className="text-xs text-muted-foreground">Signed</p>
              {!isClosed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setClosure(c => ({ ...c, clientSignature: '' }))}
                >
                  Clear Signature
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">No signature captured yet.</p>
              {!isClosed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSignaturePad(!showSignaturePad)}
                >
                  {showSignaturePad ? 'Cancel' : 'Capture Signature'}
                </Button>
              )}
            </div>
          )}
          {showSignaturePad && !closure.clientSignature && (
            <div className="mt-3">
              <SignaturePad
                onSave={(signature: string) => {
                  setClosure(c => ({ ...c, clientSignature: signature }));
                  setShowSignaturePad(false);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Documents */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold">Documents</h3>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Certificate</span>
            {caseData?.certificateUrl ? (
              <a
                href={caseData.certificateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                <FileText size={14} /> View <ExternalLink size={10} />
              </a>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Petty Cash Voucher</span>
            {caseData?.pettyCashVoucherUrl ? (
              <a
                href={caseData.pettyCashVoucherUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                <FileText size={14} /> View <ExternalLink size={10} />
              </a>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {!isClosed && (
        <div className="flex gap-2">
          {!readOnly && (
            <Button onClick={handleSave} disabled={saving} variant="outline">
              {saving ? 'Saving...' : 'Save Progress'}
            </Button>
          )}
          {!readOnly && (
            <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={saving || !closure.closureOutcome || !closure.clientSignature}
                  variant="default"
                >
                  {saving ? 'Closing...' : 'Close Case'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Close Case?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently close this case. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={async () => {
                    await handleFinalClosure();
                    setCloseDialogOpen(false);
                  }}>
                    Close Case
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}

      {/* Download CSR PDF */}
      <div className="rounded-lg border bg-card px-4 py-3">
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => downloadCsrPdf(caseId)}
        >
          <Download size={14} /> Download Case Study Report (CSR)
        </Button>
      </div>
    </div>
  );
}
