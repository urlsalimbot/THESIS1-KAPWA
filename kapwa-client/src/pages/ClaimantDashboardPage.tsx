import { useState } from 'react';
import useSWR from 'swr';
import { useSWRConfig } from 'swr';
import { useTranslation } from 'react-i18next';
import { api, csrfHeaders, downloadFilingDoc, filingDocIdFromUrl } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { Link } from 'react-router-dom';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { statusLabel } from '@/i18n/display';
import { formatDate } from '../lib/format';
import { toast } from 'sonner';

interface ServiceRecord {
  id: string; type: string; date: string; amount: number; status: string;
}

interface MyCaseDetail {
  id: string; controlNo: string; status: string;
  serviceRequested: string[];
  createdAt: string; updatedAt?: string;
  amountAssistance: number | null;
  assignedWorkerName: string | null;
  // System-issued paperwork. Null until an MSWDO admin issues it, which can
  // only happen once the case is active.
  certificateUrl?: string | null;
  pettyCashVoucherUrl?: string | null;
}

interface ConsentRecord {
  id: string; purpose: string; channel: string; status: string; grantedAt: string;
}

export function ClaimantDashboardPage() {
  const { t } = useTranslation();
  const { data: servicesData } = useSWR<{ services?: ServiceRecord[]; caseStatus?: string; case?: MyCaseDetail | null }>(
    queryKeys.beneficiaries.myServices(),
  );
  const { data: consents = [] } = useSWR<ConsentRecord[]>(queryKeys.beneficiaries.myConsent());
  const caseId = servicesData?.case?.id;
  const { data: myDocs = [], mutate: mutateDocs } = useSWR<any[]>(caseId ? `/filing?caseId=${caseId}` : null);
  const { data: myRequirements, mutate: mutateRequirements } = useSWR<{
    case: { id: string; controlNo: string; status: string } | null;
    requirements: Array<{ key: string; mandatory: boolean; met: boolean; pendingVerification: boolean; documents: Array<{ id: string; originalName?: string; verifiedAt?: string }> }>;
  }>(queryKeys.beneficiaries.myRequirements());
  const { mutate: globalMutate } = useSWRConfig();
  const [uploading, setUploading] = useState(false);
  const [granting, setGranting] = useState(false);
  const loading = !servicesData && !consents.length;

  /**
   * Open one of the system-issued documents. The raw stored URL cannot be
   * handed to the browser: the filing route sits behind the Bearer token, so a
   * bare navigation would arrive unauthenticated. Extract the id and download
   * through the authenticated helper instead — same path the case view uses.
   */
  async function viewGeneratedDoc(url: string | null | undefined, fallbackName: string) {
    const docId = url ? filingDocIdFromUrl(url) : null;
    if (!docId) {
      toast.error(t('claims.downloadFailed', 'Download failed'));
      return;
    }
    try {
      await downloadFilingDoc(docId, fallbackName);
    } catch {
      toast.error(t('claims.downloadFailed', 'Download failed'));
    }
  }

  async function downloadUploaded(id: string, name: string) {
    try {
      await downloadFilingDoc(id, name);
    } catch {
      toast.error(t('claims.downloadFailed', 'Download failed'));
    }
  }

  async function uploadRequirement(file: File, requirementKey: string) {
    if (!caseId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('caseId', caseId);
      fd.append('requirementKey', requirementKey);
      fd.append('category', 'requirement');
      fd.append('file', file);
      const token = localStorage.getItem('kapwa_token');
      const base = (import.meta as any).env?.VITE_API_URL || '/api/v1';
      const res = await fetch(`${base}/filing/upload`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...csrfHeaders() },
        body: fd,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      await mutateRequirements();
      await mutateDocs();
    } finally {
      setUploading(false);
    }
  }

  async function uploadDoc(file: File) {
    if (!caseId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('caseId', caseId);
      fd.append('category', 'claimant_upload');
      fd.append('notes', 'Uploaded by claimant');
      fd.append('file', file);
      const token = localStorage.getItem('kapwa_token');
      const base = (import.meta as any).env?.VITE_API_URL || '/api/v1';
      const res = await fetch(`${base}/filing/upload`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...csrfHeaders() },
        body: fd,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      await mutateDocs();
    } finally {
      setUploading(false);
    }
  }

  async function grantConsent() {
    setGranting(true);
    try {
      await api.post('/beneficiaries/me/consent/grant', {});
      await globalMutate(queryKeys.beneficiaries.myConsent());
    } finally {
      setGranting(false);
    }
  }

  const services = servicesData?.services || [];
  const myCase = servicesData?.case || null;
  const rawStatus = servicesData?.caseStatus;
  const normalized = (rawStatus || '').toLowerCase().replace(/\s+/g, '_');
  const caseStatus =
    rawStatus && rawStatus !== 'No active case'
      ? statusLabel(t, normalized)
      : t('dashboard.noActiveCase', 'No active case');
  const statusVariant = normalized === 'transitioning' ? 'default' : 'outline';
  const lastSync = servicesData ? Date.now() : null;

  if (loading) {
    return (
      <PageShell title={t('claims.myDashboard', 'My Dashboard')} description={t('claims.dashboardDescription', 'Your case and assistance overview')}>
        <CardGridSkeleton count={4} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={t('claims.myDashboard', 'My Dashboard')}
      description={t('claims.dashboardDescription2', 'Service history, case status, and consent management')}
      cachedAt={lastSync ?? undefined}
    >
      {/* Access Card Link */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{t('claims.accessCard', 'Access Card')}</p>
            <p className="text-sm font-medium text-primary">{t('claims.viewAccessCard', 'View your KAPWA Access Card')}</p>
          </div>
          <Link to="/my-access-card">
            <Button variant="default" size="sm">{t('claims.viewCard', 'View Card')}</Button>
          </Link>
        </CardContent>
      </Card>

      {/* Case Status */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{t('claims.caseStatus', 'Case Status')}</p>
              <p className="text-lg font-semibold text-primary">{caseStatus}</p>
            </div>
            <Badge variant={statusVariant}>{caseStatus}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Case Details */}
      {myCase && (
        <Card>
          <div className="border-b px-4 py-3 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-primary">{t('claims.caseDetails', 'Case Details')}</h2>
            <span className="text-xs font-mono text-muted-foreground">{myCase.controlNo}</span>
          </div>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{t('claims.dateFiled', 'Date Filed')}</p>
                <p className="text-sm font-medium">{formatDate(myCase.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('claims.assignedWorker', 'Assigned Worker')}</p>
                <p className="text-sm font-medium">{myCase.assignedWorkerName || t('claims.notAssigned', 'Not assigned')}</p>
              </div>
              {myCase.amountAssistance != null && (
                <div>
                  <p className="text-xs text-muted-foreground">{t('claims.amountAssistance', 'Assistance Amount')}</p>
                  <p className="text-sm font-semibold">₱{myCase.amountAssistance.toLocaleString()}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">{t('claims.lastUpdated', 'Last Updated')}</p>
                <p className="text-sm font-medium">{myCase.updatedAt ? formatDate(myCase.updatedAt) : '—'}</p>
              </div>
            </div>
            {myCase.serviceRequested.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">{t('claims.serviceRequested', 'Services Requested')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {myCase.serviceRequested.map((s) => (
                    <span key={s} className="rounded-md bg-primary/5 border border-primary/15 px-2 py-0.5 text-xs text-primary">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Documentary Needs — client uploads remotely, then MSWDO confirms on-site */}
      {(myRequirements?.requirements?.length || 0) > 0 && (
        <Card>
          <div className="border-b px-4 py-3 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-primary">{t('claims.documentaryNeeds', 'Documentary Needs')}</h2>
            <span className="text-xs text-muted-foreground">
              {t('claims.documentaryNeedsHint', 'Upload here, then bring the original to the office')}
            </span>
          </div>
          <CardContent className="p-4 space-y-3">
            {(myRequirements?.requirements || []).map((req) => {
              const submitted = req.documents.length > 0;
              return (
                <div key={req.key} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{req.key}</p>
                      {req.mandatory && (
                        <p className="text-[11px] text-muted-foreground">{t('claims.required', 'Required')}</p>
                      )}
                    </div>
                    {req.met ? (
                      <Badge variant="default" className="shrink-0 text-[10px]">{t('claims.requirementMet', 'Confirmed')}</Badge>
                    ) : req.pendingVerification ? (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">{t('claims.pendingOnSite', 'Pending on-site')}</Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0 text-[10px]">{t('claims.notSubmitted', 'Not submitted')}</Badge>
                    )}
                  </div>
                  {submitted && (
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {req.documents.map((d) => (
                        <li key={d.id} className="truncate">
                          {d.originalName || d.id}
                          {d.verifiedAt ? ` · ${t('claims.verified', 'verified')}` : ` · ${t('claims.awaitingVerification', 'awaiting on-site verification')}`}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!req.met && (
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted">
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        disabled={uploading}
                        aria-label={t('claims.uploadFor', 'Upload for {{key}}', { key: req.key })}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadRequirement(f, req.key);
                          e.target.value = '';
                        }}
                      />
                      {uploading ? t('claims.uploading', 'Uploading…') : t('claims.uploadDocument', 'Upload document')}
                    </label>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Service History */}
      <Card>
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold text-sm text-primary">{t('claims.serviceHistory', 'Service History')}</h2>
        </div>
        {services.length === 0 ? (
          <CardContent>
            <p className="text-center py-8 text-sm text-muted-foreground">{t('claims.noServices', 'No services recorded yet.')}</p>
          </CardContent>
        ) : (
          <div className="divide-y">
            {services.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{s.type}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(s.date)}</p>
                </div>
                <div className="text-right">
                  {s.amount > 0 && <p className="text-sm font-semibold">₱{s.amount.toLocaleString()}</p>}
                  <span className={`text-xs ${s.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'}`}>{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Documents */}
      <Card>
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold text-sm text-primary">{t('claims.myDocuments', 'My Documents')}</h2>
        </div>
        <CardContent className="p-4 space-y-3">
          <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground hover:bg-muted">
            {uploading ? t('common.uploading', 'Uploading…') : t('claims.uploadPrompt', 'Click to upload a document (ID, certificate, receipt)')}
            <input
              type="file"
              className="sr-only"
              disabled={uploading || !caseId}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc(f); e.target.value = ''; }}
            />
          </label>
          {/* Every document filed against this case — uploaded by the claimant or
              by the office. The list route already scopes a caseId the claimant
              owns to that case alone, so nothing here can widen past their own
              file. Approval documents are excluded because they are issued, not
              uploaded, and have their own card below. */}
          {(() => {
            const uploaded = (myDocs as any[]).filter((d) => d.category !== 'approval_document');
            if (uploaded.length === 0) {
              return <p className="text-xs text-muted-foreground">{t('claims.noDocuments', 'No documents uploaded yet.')}</p>;
            }
            return (
              <ul className="divide-y text-sm">
                {uploaded.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 flex-1 truncate">{d.originalName || d.fileName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{d.category}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => downloadUploaded(d.id, d.originalName || d.fileName || 'document')}
                    >
                      {t('claims.download', 'Download')}
                    </Button>
                  </li>
                ))}
              </ul>
            );
          })()}
        </CardContent>
      </Card>

      {/* System-issued paperwork, kept beside the uploads rather than mixed into
          them so the reader never has to work out which file the office attached
          and which the system issued — the same split the case view makes. */}
      {myCase && (myCase.certificateUrl || myCase.pettyCashVoucherUrl) && (
        <Card>
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold text-sm text-primary">{t('claims.generatedDocuments', 'Generated Documents')}</h2>
          </div>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              {t('claims.generatedDocumentsHint', 'Issued by the system at approval, not uploaded.')}
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {myCase.certificateUrl && (
                <button
                  type="button"
                  onClick={() => viewGeneratedDoc(myCase.certificateUrl, 'certificate-of-eligibility.pdf')}
                  className="inline-flex items-center gap-1.5 rounded text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {t('claims.viewCertificate', 'View Certificate of Eligibility')}
                </button>
              )}
              {myCase.pettyCashVoucherUrl && (
                <button
                  type="button"
                  onClick={() => viewGeneratedDoc(myCase.pettyCashVoucherUrl, 'petty-cash-voucher.pdf')}
                  className="inline-flex items-center gap-1.5 rounded text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {t('claims.viewPettyCashVoucher', 'View Petty Cash Voucher')}
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold text-sm text-primary">{t('claims.consentManagement', 'Consent Management')}</h3>
        </div>
        {consents.length === 0 ? (
          <CardContent>
            <p className="text-center py-8 text-sm text-muted-foreground">{t('dashboard.noConsentRecords', 'No consent records found')}</p>
          </CardContent>
        ) : (
          <div className="divide-y">
            {consents.map(c => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{c.purpose}</p>
                  <p className="text-xs text-muted-foreground">{t('claims.viaChannel', 'Via {{channel}}', { channel: c.channel })} · {formatDate(c.grantedAt)}</p>
                </div>
                <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>{c.status}</Badge>
              </div>
            ))}
          </div>
        )}
        <div className="border-t px-4 py-3 space-y-2">
          {consents.length > 0 && consents[0].status !== 'active' && (
            <Button size="sm" onClick={grantConsent} disabled={granting}>
              {granting ? t('common.saving', 'Saving…') : t('claims.grantConsent', 'Grant consent again')}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">{t('claims.dataPrivacyNotice', 'Your data is processed per RA 10173 (Data Privacy Act). You may revoke consent at any time.')}</p>
        </div>
      </Card>
    </PageShell>
  );
}
