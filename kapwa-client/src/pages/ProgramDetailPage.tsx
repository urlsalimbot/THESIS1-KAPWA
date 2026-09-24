import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSWR, { useSWRConfig } from 'swr';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { humanizeError } from '@/lib/errors';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Calendar, CheckCircle, Coins, FileText, Landmark, Power, ScrollText, Shield, Trash2, XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApprovalStep {
  stepName: string;
  approverRole: string;
  slaDays: number;
  order: number;
}

interface ProgramDetail {
  id: string;
  name: string;
  category?: string;
  waitingPeriodDays?: number;
  legalBasis?: string;
  requiredDocuments?: string[];
  fundSources?: string[];
  approvalWorkflow?: ApprovalStep[];
  formTemplate?: Record<string, unknown>;
  formVersion: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{children}</span>
    </div>
  );
}

export function ProgramDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { mutate: globalMutate } = useSWRConfig();
  const { data: program, isLoading, mutate } = useSWR<ProgramDetail>(
    id ? queryKeys.programs.detail(id) : null,
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!id) return;
    setBusy(true);
    try {
      await api.del(`/programs/${id}`);
      toast.success(t('programs.deleted', 'Program deleted'));
      await globalMutate(queryKeys.programs.list());
      navigate('/admin/programs');
    } catch (err) {
      toast.error(t('programs.deleteFailed', 'Error deleting program'), { description: humanizeError(err) });
    } finally {
      setBusy(false);
      setDeleteOpen(false);
    }
  }

  async function toggleActive() {
    if (!id || !program) return;
    setBusy(true);
    try {
      await api.patch(`/programs/${id}`, { isActive: !program.isActive });
      await mutate();
      await globalMutate(queryKeys.programs.list());
      toast.success(
        program.isActive
          ? t('programs.deactivated', 'Program deactivated')
          : t('programs.activated', 'Program activated'),
      );
    } catch (err) {
      toast.error(t('programs.updateFailed', 'Could not update program'), { description: humanizeError(err) });
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <PageShell title={t('programs.loadingTitle', 'Loading...')} description="">
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">{t('programs.loadingProgram', 'Loading program...')}</div>
      </PageShell>
    );
  }

  if (!program) {
    return (
      <PageShell title={t('programs.notFoundTitle', 'Program Not Found')} description="" backTo={{ label: t('programs.backToPrograms', 'Back to Programs'), onClick: () => navigate('/admin/programs') }}>
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileText size={40} className="mb-3 opacity-30" aria-hidden="true" />
          <p className="text-sm">{t('programs.notFound', 'Program not found.')}</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={program.name}
      description={program.category || t('programs.interventionProgram', 'Intervention Program')}
      backTo={{ label: t('programs.backToPrograms', 'Back to Programs'), onClick: () => navigate('/admin/programs') }}
      actions={
        <div className="flex items-center gap-2">
          <Badge variant={program.isActive ? 'default' : 'secondary'} className={cn(program.isActive && 'bg-emerald-500')}>
            {program.isActive ? t('programs.active', 'Active') : t('programs.inactive', 'Inactive')}
          </Badge>
          <Button variant="outline" size="sm" onClick={toggleActive} disabled={busy} className="gap-1.5">
            <Power size={14} aria-hidden="true" />
            {program.isActive ? t('programs.deactivate', 'Deactivate') : t('programs.activate', 'Activate')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} disabled={busy}
            className="gap-1.5 text-destructive hover:text-destructive">
            <Trash2 size={14} aria-hidden="true" />
            {t('programs.delete', 'Delete')}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        {/* === LEFT (2/3) === */}
        <div className="space-y-4 lg:col-span-2">
          {/* Overview */}
          <section className="rounded-xl border bg-card">
            <header className="flex items-center gap-2 px-4 py-3">
              <ScrollText size={16} className="text-accent" aria-hidden="true" />
              <h2 className="text-sm font-semibold">{t('programs.overview', 'Overview')}</h2>
            </header>
            <Separator />
            <div className="px-4 py-3">
              {program.legalBasis && (
                <div className="mb-3 rounded-lg bg-muted/40 px-3 py-2 text-sm leading-relaxed text-muted-foreground">
                  {program.legalBasis}
                </div>
              )}
              <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                {program.category && <InfoRow label={t('programs.category', 'Category')}>{program.category}</InfoRow>}
                <InfoRow label={t('programs.waitingPeriod', 'Waiting Period')}>
                  {program.waitingPeriodDays != null ? t('programs.days', '{{count}} days', { count: program.waitingPeriodDays }) : '—'}
                </InfoRow>
                <InfoRow label={t('programs.formVersion', 'Form Version')}>{program.formVersion}</InfoRow>
                <InfoRow label={t('programs.status', 'Status')}>
                  <span className="inline-flex items-center gap-1">
                    {program.isActive ? <CheckCircle size={14} className="text-emerald-500" aria-hidden="true" /> : <XCircle size={14} className="text-muted-foreground" aria-hidden="true" />}
                    {program.isActive ? t('programs.active', 'Active') : t('programs.inactive', 'Inactive')}
                  </span>
                </InfoRow>
              </div>
            </div>
          </section>

          {/* Required Documents */}
          <section className="rounded-xl border bg-card">
            <header className="flex items-center gap-2 px-4 py-3">
              <FileText size={16} className="text-accent" aria-hidden="true" />
              <h2 className="text-sm font-semibold">{t('programs.requiredDocuments', 'Required Documents')}</h2>
              <span className="ml-auto text-xs text-muted-foreground">{t('programs.itemCount', '{{count}} item', { count: program.requiredDocuments?.length ?? 0 })}</span>
            </header>
            <Separator />
            <div className="px-4 py-3">
              {program.requiredDocuments && program.requiredDocuments.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {program.requiredDocuments.map((doc, i) => (
                    <li key={i}><Badge variant="outline" className="font-normal">{doc}</Badge></li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t('programs.noDocuments', 'No documents required.')}</p>
              )}
            </div>
          </section>

          {/* Approval Workflow */}
          <section className="rounded-xl border bg-card">
            <header className="flex items-center gap-2 px-4 py-3">
              <Shield size={16} className="text-accent" aria-hidden="true" />
              <h2 className="text-sm font-semibold">{t('programs.approvalWorkflow', 'Approval Workflow')}</h2>
              <span className="ml-auto text-xs text-muted-foreground">{t('programs.stepCount', '{{count}} step', { count: program.approvalWorkflow?.length ?? 0 })}</span>
            </header>
            <Separator />
            <div className="px-4 py-3">
              {program.approvalWorkflow && program.approvalWorkflow.length > 0 ? (
                <ol className="space-y-3">
                  {[...program.approvalWorkflow].sort((a, b) => a.order - b.order).map((s, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{s.stepName}</p>
                        <p className="text-xs text-muted-foreground">{t('programs.approver', 'Approver: {{role}} · SLA: {{days}}d', { role: s.approverRole, days: s.slaDays })}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">{t('programs.noWorkflow', 'No approval steps configured.')}</p>
              )}
            </div>
          </section>
        </div>

        {/* === RIGHT (1/3) === */}
        <div className="space-y-4">
          {/* Fund Sources */}
          <section className="rounded-xl border bg-card">
            <header className="flex items-center gap-2 px-4 py-3">
              <Coins size={16} className="text-accent" aria-hidden="true" />
              <h2 className="text-sm font-semibold">{t('programs.fundSources', 'Fund Sources')}</h2>
            </header>
            <Separator />
            <div className="px-4 py-3">
              {program.fundSources && program.fundSources.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {program.fundSources.map((fs, i) => <Badge key={i} variant="outline">{fs}</Badge>)}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('programs.noneConfigured', 'None configured')}</p>
              )}
            </div>
          </section>

          {/* Form Template */}
          <section className="rounded-xl border bg-card">
            <header className="flex items-center gap-2 px-4 py-3">
              <Landmark size={16} className="text-accent" aria-hidden="true" />
              <h2 className="text-sm font-semibold">{t('programs.formTemplate', 'Form Template')}</h2>
            </header>
            <Separator />
            <div className="px-4 py-3">
              <p className="text-sm text-foreground">
                {program.formTemplate ? t('programs.configured', 'Configured') : t('programs.none', 'None')}
              </p>
              {program.formTemplate && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('programs.fieldCount', '{{count}} field defined', { count: Object.keys(program.formTemplate).length })}
                </p>
              )}
            </div>
          </section>

          {/* Metadata */}
          <section className="rounded-xl border bg-card">
            <header className="flex items-center gap-2 px-4 py-3">
              <Calendar size={16} className="text-accent" aria-hidden="true" />
              <h2 className="text-sm font-semibold">{t('programs.metadata', 'Metadata')}</h2>
            </header>
            <Separator />
            <div className="px-4 py-2">
              <InfoRow label={t('programs.created', 'Created')}>{new Date(program.createdAt).toLocaleDateString()}</InfoRow>
              <InfoRow label={t('programs.updated', 'Updated')}>{new Date(program.updatedAt).toLocaleDateString()}</InfoRow>
              <InfoRow label={t('programs.waitingShort', 'Waiting')}>
                {program.waitingPeriodDays != null ? t('programs.days', '{{count}} days', { count: program.waitingPeriodDays }) : '—'}
              </InfoRow>
            </div>
          </section>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('programs.deleteTitle', 'Delete this program?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('programs.deleteConfirm', 'Delete this program? This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('programs.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('programs.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
