import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileText, CheckCircle, Clock, ExternalLink } from 'lucide-react';
import SignaturePad from '../forms/SignaturePad';

interface StepSignaturesProps {
  caseData: any;
}

export function StepSignatures({ caseData }: StepSignaturesProps) {
  const isApproved = caseData?.status === 'active' || caseData?.status === 'transitioning' || caseData?.status === 'closed';
  const isClosed = caseData?.status === 'closed';

  return (
    <div className="space-y-4">
      {/* Approval Status */}
      <div className="rounded-lg border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Case Status</h3>
          <Badge variant={isApproved ? 'default' : 'outline'} className="text-sm">
            {isApproved ? <CheckCircle size={12} className="mr-1" /> : <Clock size={12} className="mr-1" />}
            {caseData?.status?.replace(/_/g, ' ') || 'pending'}
          </Badge>
        </div>
      </div>

      {/* Client Signature */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold">Client Signature</h3>
        </div>
        <Separator />
        <div className="px-4 py-3">
          {caseData?.clientSignature ? (
            <div className="space-y-2">
              <img src={caseData.clientSignature} alt="Client signature" className="max-h-20 border rounded bg-white" />
              <p className="text-xs text-muted-foreground">Signed</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No signature captured yet.</p>
          )}
        </div>
      </div>

      {/* Worker / Approver Signatures */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold">Social Worker & Approver</h3>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-muted-foreground text-xs">Assigned Worker</span>
              <p className="font-medium">{caseData?.assignedWorker?.fullName || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Approved By</span>
              <p className="font-medium">{caseData?.approvedByRole?.replace(/_/g, ' ') || '—'}</p>
            </div>
          </div>
          {caseData?.approvedBySignature && (
            <div>
              <span className="text-muted-foreground text-xs">Approver Signature</span>
              <img src={caseData.approvedBySignature} alt="Approver signature" className="max-h-16 border rounded bg-white mt-1" />
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
              <a href={caseData.certificateUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                <FileText size={14} /> View <ExternalLink size={10} />
              </a>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Petty Cash Voucher</span>
            {caseData?.pettyCashVoucherUrl ? (
              <a href={caseData.pettyCashVoucherUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                <FileText size={14} /> View <ExternalLink size={10} />
              </a>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Export to PDF placeholder */}
      <div className="rounded-lg border bg-card px-4 py-3">
        <Button variant="outline" className="w-full" disabled>
          <FileText size={14} className="mr-2" /> Export Case to PDF (Coming Soon)
        </Button>
      </div>
    </div>
  );
}
