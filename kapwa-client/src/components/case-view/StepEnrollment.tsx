import { Separator } from '@/components/ui/separator';
import { User, Calendar, Briefcase, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface StepEnrollmentProps {
  caseData: any;
}

export function StepEnrollment({ caseData }: StepEnrollmentProps) {
  const { t } = useTranslation();
  const ben = caseData?.beneficiary;
  const createdAt = caseData?.createdAt ? new Date(caseData.createdAt).toLocaleDateString() : '—';

  return (
    <div className="space-y-4">
      {/* Enrollment Summary */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 flex items-center gap-2">
          <FileText size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">{t('caseView.enrollment.summary', 'Enrollment Summary')}</h3>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">{t('caseView.enrollment.caseNumber', 'Case Number')}</span>
              <p className="font-medium">{caseData?.controlNo || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">{t('caseView.enrollment.dateEnrolled', 'Date Enrolled')}</span>
              <p className="font-medium">{createdAt}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Service Requested */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 flex items-center gap-2">
          <Briefcase size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">{t('caseView.enrollment.serviceRequested', 'Service Requested')}</h3>
        </div>
        <Separator />
        <div className="px-4 py-3">
          {caseData?.serviceRequested?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {caseData.serviceRequested.map((service: string, idx: number) => (
                <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  {service}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('caseView.enrollment.noServices', 'No services specified')}</p>
          )}
        </div>
      </div>

      {/* Assigned Worker */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 flex items-center gap-2">
          <User size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">{t('caseView.enrollment.assignedWorker', 'Assigned Worker')}</h3>
        </div>
        <Separator />
        <div className="px-4 py-3">
          {caseData?.assignedWorker ? (
            <div className="text-sm">
              <p className="font-medium">{caseData.assignedWorker.fullName}</p>
              {caseData.assignedWorker.position && (
                <p className="text-muted-foreground text-xs">{caseData.assignedWorker.position}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('caseView.enrollment.noWorker', 'No worker assigned')}</p>
          )}
        </div>
      </div>

      {/* Beneficiary Info */}
      {ben && (
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3 flex items-center gap-2">
            <User size={16} className="text-primary" />
            <h3 className="text-sm font-semibold">{t('caseView.enrollment.beneficiary', 'Beneficiary')}</h3>
          </div>
          <Separator />
          <div className="px-4 py-3 space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">{t('caseView.enrollment.fullName', 'Full Name')}</span>
              <p className="font-medium">{ben.firstName} {ben.middleName || ''} {ben.surname}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-muted-foreground text-xs">{t('caseView.enrollment.gender', 'Gender')}</span>
                <p>{ben.gender || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">{t('caseView.enrollment.dateOfBirth', 'Date of Birth')}</span>
                <p>{ben.dob ? new Date(ben.dob).toLocaleDateString() : '—'}</p>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">{t('caseView.enrollment.address', 'Address')}</span>
              <p>{ben.address || '—'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
