import { useState, useEffect, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { Shield } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, exportIrfPdf } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { ColumnDef, PaginationState, Updater } from '@tanstack/react-table';

interface IrfCase {
  id: string;
  blotterEntryNumber: string;
  caseCategory: string;
  datetimeReported: string;
  itemAReportingPerson: Record<string, unknown>;
  caseDisposition: string;
  createdAt: string;
}

export function IrfPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const urlLimit = parseInt(searchParams.get('limit') || '10', 10);
  const { data: irfResponse, isLoading: loading } = useSWR<{ data: IrfCase[]; total: number }>(
    [...queryKeys.irf.list(), { page: urlPage, limit: urlLimit }],
    { keepPreviousData: true },
  );
  const irfs = irfResponse?.data ?? [];
  const irfTotal = irfResponse?.total ?? 0;
  const lastSync = irfResponse ? Date.now() : null;

  const [exportIrfId, setExportIrfId] = useState<string | null>(null);
  const [legalBasis, setLegalBasis] = useState('');
  const [pdfPassword, setPdfPassword] = useState('');
  const [exporting, setExporting] = useState(false);

  const updateURL = useCallback((overrides: Record<string, string | undefined>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(overrides)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const pagination: PaginationState = { pageIndex: urlPage - 1, pageSize: urlLimit };

  const onPaginationChange = useCallback(
    (updater: Updater<PaginationState>) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater;
      updateURL({ page: String(next.pageIndex + 1), limit: String(next.pageSize) });
    },
    [pagination, updateURL],
  );

  async function handleExportPdf() {
    if (!exportIrfId || !legalBasis) return;
    setExporting(true);
    try {
      await exportIrfPdf(exportIrfId, legalBasis, pdfPassword || 'default');
      setExportIrfId(null);
      setLegalBasis('');
      setPdfPassword('');
    } catch (e) { console.error('PDF export:', e); alert(t('irf.pdfExportFailed', 'PDF export failed')); }
    setExporting(false);
  }

  async function handleExportJson() {
    if (!exportIrfId || !legalBasis) return;
    setExporting(true);
    try {
      const data = await api.get(`/irf/${exportIrfId}/export-json?legalBasis=${encodeURIComponent(legalBasis)}`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `IRF-${exportIrfId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportIrfId(null);
      setLegalBasis('');
      setPdfPassword('');
    } catch (e) { console.error('JSON export:', e); alert(t('irf.jsonExportFailed', 'JSON export failed')); }
    setExporting(false);
  }

  const columns: ColumnDef<IrfCase>[] = [
    { accessorKey: 'blotterEntryNumber', header: t('irf.blotterNo', 'Blotter #'), cell: ({ row }) => <span className="font-mono font-semibold text-primary">{row.original.blotterEntryNumber}</span> },
    {
      accessorKey: 'caseCategory', header: t('irf.category', 'Category'),
      cell: ({ row }) => <Badge variant="outline">{row.original.caseCategory}</Badge>,
    },
    {
      accessorKey: 'itemAReportingPerson', header: t('irf.reporter', 'Reporter'),
      cell: ({ row }) => {
        const name = (row.original.itemAReportingPerson as Record<string, unknown>)?.name as string | undefined;
        return <span className="text-muted-foreground">{name || t('irf.confidential', '[CONFIDENTIAL]')}</span>;
      },
    },
    { accessorKey: 'caseDisposition', header: t('irf.disposition', 'Disposition') },
    {
      accessorKey: 'datetimeReported', header: t('irf.reported', 'Reported'),
      cell: ({ row }) => <span className="text-muted-foreground">{new Date(row.original.datetimeReported).toLocaleDateString()}</span>,
    },
    {
      id: 'actions',
      header: t('irf.actions', 'Actions'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/irf/' + row.original.id)} aria-label={t('irf.viewDetails', 'View Details')}>
            {t('irf.viewDetails', 'View Details')}
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => setExportIrfId(row.original.id)}
            aria-label={t('irf.exportIrf', 'Export IRF')}
          >
            <Shield size={14} className="mr-1" /> {t('irf.export', 'Export')}
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <PageShell title={t('irf.title', 'Incident Report Forms (IRF)')} description={t('irf.description', 'VAWC/RA 9262 cases — MSWDO Norzagaray')}>
        <TableSkeleton rows={5} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={t('irf.title', 'Incident Report Forms (IRF)')}
      description={t('irf.description', 'VAWC/RA 9262 cases — MSWDO Norzagaray')}
      cachedAt={lastSync ?? undefined}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <Button variant="default" onClick={() => navigate('/irf/new')} aria-label={t('irf.newIrf', '+ New IRF')}>
          {t('irf.newIrf', '+ New IRF')}
        </Button>
      </div>

      {/* Data table / Empty state */}
      {!loading && irfs.length === 0 ? (
        <EmptyState variant="no-data" />
      ) : (
        <DataTable
          columns={columns}
          data={irfs}
          rowCount={irfTotal}
          pagination={pagination}
          onPaginationChange={onPaginationChange}
          sorting={[]}
        />
      )}

      {/* Export Modal */}
      {exportIrfId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="w-full max-w-sm shadow-xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="text-primary" size={20} />
                <CardTitle className="text-base">{t('irf.exportIrfTitle', 'Export IRF')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {t('irf.legalBasisNote', 'Legal basis code is required per DSWD AO 2020-002. This export is logged.')}
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('irf.legalBasisCode', 'Legal Basis Code')}</label>
                <Input
                  value={legalBasis}
                  onChange={e => setLegalBasis(e.target.value)}
                  aria-label={t('irf.legalBasisCode', 'Legal Basis Code')}
                  placeholder={t('irf.legalBasisPlaceholder', 'e.g. AO-2020-002')}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('irf.pdfPassword', 'PDF Password')}</label>
                <Input
                  value={pdfPassword}
                  onChange={e => setPdfPassword(e.target.value)}
                  type="password"
                  aria-label={t('irf.pdfPasswordAria', 'PDF password')}
                  placeholder={t('irf.pdfPasswordPlaceholder', 'PDF password (optional)')}
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => { setExportIrfId(null); setLegalBasis(''); setPdfPassword(''); }}
                  aria-label={t('irf.cancel', 'Cancel')}
                >
                  {t('irf.cancel', 'Cancel')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportJson}
                  disabled={!legalBasis || exporting}
                  aria-label={t('irf.exportJson', 'Export JSON')}
                >
                  {t('irf.exportJson', 'Export JSON')}
                </Button>
                <Button
                  variant="default"
                  onClick={handleExportPdf}
                  disabled={!legalBasis || exporting}
                  aria-label={t('irf.exportPdf', 'Export PDF')}
                >
                  {exporting ? t('irf.exporting', 'Exporting...') : t('irf.exportPdf', 'Export PDF')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
