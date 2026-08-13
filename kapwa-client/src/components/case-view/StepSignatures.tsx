import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileText, CheckCircle, Clock, ExternalLink } from 'lucide-react';
import SignaturePad from '../forms/SignaturePad';
import { useTranslation } from 'react-i18next';
import { statusLabel } from '@/i18n/display';

interface StepSignaturesProps {
  caseData: any;
}

export function StepSignatures({ caseData }: StepSignaturesProps) {
  const { t } = useTranslation();
  const isApproved = caseData?.status === 'active' || caseData?.status === 'transitioning' || caseData?.status === 'closed';
  const isClosed = caseData?.status === 'closed';

  return (
    <div className="space-y-4">
      {/* Approval Status */}
      <div className="rounded-lg border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t('caseView.signatures.caseStatus', 'Case Status')}</h3>
          <Badge variant={isApproved ? 'default' : 'outline'} className="text-sm">
            {isApproved ? <CheckCircle size={12} className="mr-1" /> : <Clock size={12} className="mr-1" />}
            {statusLabel(t, caseData?.status || 'pending')}
          </Badge>
        </div>
      </div>

      {/* Client Signature */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold">{t('caseView.signatures.clientSignature', 'Client Signature')}</h3>
        </div>
        <Separator />
        <div className="px-4 py-3">
          {caseData?.clientSignature ? (
            <div className="space-y-2">
              <img src={caseData.clientSignature} alt={t('caseView.signatures.clientSignatureAlt', 'Client signature')} className="max-h-20 border rounded bg-white" />
              <p className="text-xs text-muted-foreground">{t('caseView.signatures.signed', 'Signed')}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('caseView.signatures.noSignature', 'No signature captured yet.')}</p>
          )}
        </div>
      </div>

      {/* Worker / Approver Signatures */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold">{t('caseView.signatures.workerApprover', 'Social Worker & Approver')}</h3>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-muted-foreground text-xs">{t('caseView.signatures.assignedWorker', 'Assigned Worker')}</span>
              <p className="font-medium">{caseData?.assignedWorker?.fullName || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">{t('caseView.signatures.approvedBy', 'Approved By')}</span>
              <p className="font-medium">{caseData?.approvedByRole?.replace(/_/g, ' ') || '—'}</p>
            </div>
          </div>
          {caseData?.approvedBySignature && (
            <div>
              <span className="text-muted-foreground text-xs">{t('caseView.signatures.approverSignature', 'Approver Signature')}</span>
              <img src={caseData.approvedBySignature} alt={t('caseView.signatures.approverSignatureAlt', 'Approver signature')} className="max-h-16 border rounded bg-white mt-1" />
            </div>
          )}
        </div>
      </div>

      {/* Documents */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold">{t('caseView.signatures.documents', 'Documents')}</h3>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('caseView.signatures.certificate', 'Certificate')}</span>
            {caseData?.certificateUrl ? (
              <a href={caseData.certificateUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                <FileText size={14} /> {t('caseView.signatures.view', 'View')} <ExternalLink size={10} />
              </a>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('caseView.signatures.pettyCashVoucher', 'Petty Cash Voucher')}</span>
            {caseData?.pettyCashVoucherUrl ? (
              <a href={caseData.pettyCashVoucherUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                <FileText size={14} /> {t('caseView.signatures.view', 'View')} <ExternalLink size={10} />
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
          <FileText size={14} className="mr-2" /> {t('caseView.signatures.exportPdf', 'Export Case to PDF (Coming Soon)')}
        </Button>
      </div>
    </div>
  );
}
