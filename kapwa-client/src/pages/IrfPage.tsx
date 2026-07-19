import { useState } from 'react';
import useSWR from 'swr';
import { Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
import type { ColumnDef } from '@tanstack/react-table';

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
  const navigate = useNavigate();
  const { data: irfs = [], isLoading: loading } = useSWR<IrfCase[]>(queryKeys.irf.list());
  const lastSync = irfs.length > 0 ? Date.now() : null;

  const [exportIrfId, setExportIrfId] = useState<string | null>(null);
  const [legalBasis, setLegalBasis] = useState('');
  const [pdfPassword, setPdfPassword] = useState('');
  const [exporting, setExporting] = useState(false);

  async function handleExportPdf() {
    if (!exportIrfId || !legalBasis) return;
    setExporting(true);
    try {
      await exportIrfPdf(exportIrfId, legalBasis, pdfPassword || 'default');
      setExportIrfId(null);
      setLegalBasis('');
      setPdfPassword('');
    } catch (e) { console.error('PDF export:', e); alert('PDF export failed'); }
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
    } catch (e) { console.error('JSON export:', e); alert('JSON export failed'); }
    setExporting(false);
  }

  const columns: ColumnDef<IrfCase>[] = [
    { accessorKey: 'blotterEntryNumber', header: 'Blotter #', cell: ({ row }) => <span className="font-mono font-semibold text-primary">{row.original.blotterEntryNumber}</span> },
    {
      accessorKey: 'caseCategory', header: 'Category',
      cell: ({ row }) => <Badge variant="outline">{row.original.caseCategory}</Badge>,
    },
    {
      accessorKey: 'itemAReportingPerson', header: 'Reporter',
      cell: ({ row }) => {
        const name = (row.original.itemAReportingPerson as Record<string, unknown>)?.name as string | undefined;
        return <span className="text-muted-foreground">{name || '[CONFIDENTIAL]'}</span>;
      },
    },
    { accessorKey: 'caseDisposition', header: 'Disposition' },
    {
      accessorKey: 'datetimeReported', header: 'Reported',
      cell: ({ row }) => <span className="text-muted-foreground">{new Date(row.original.datetimeReported).toLocaleDateString()}</span>,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/irf/' + row.original.id)} aria-label="View Details">
            View Details
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => setExportIrfId(row.original.id)}
            aria-label="Export IRF"
          >
            <Shield size={14} className="mr-1" /> Export
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <PageShell title="Incident Report Forms (IRF)" description="VAWC/RA 9262 cases — MSWDO Norzagaray">
        <TableSkeleton rows={5} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Incident Report Forms (IRF)"
      description="VAWC/RA 9262 cases — MSWDO Norzagaray"
      cachedAt={lastSync ?? undefined}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <Button variant="default" onClick={() => navigate('/irf/new')} aria-label="+ New IRF">
          + New IRF
        </Button>
      </div>

      {/* Data table / Empty state */}
      {!loading && irfs.length === 0 ? (
        <EmptyState variant="no-data" />
      ) : (
        <DataTable
          columns={columns}
          data={irfs}
          rowCount={irfs.length}
          pagination={{ pageIndex: 0, pageSize: 10 }}
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
                <CardTitle className="text-base">Export IRF</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Legal basis code is required per DSWD AO 2020-002. This export is logged.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">Legal Basis Code</label>
                <Input
                  value={legalBasis}
                  onChange={e => setLegalBasis(e.target.value)}
                  aria-label="Legal Basis Code"
                  placeholder="e.g. AO-2020-002"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">PDF Password</label>
                <Input
                  value={pdfPassword}
                  onChange={e => setPdfPassword(e.target.value)}
                  type="password"
                  aria-label="PDF password"
                  placeholder="PDF password (optional)"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => { setExportIrfId(null); setLegalBasis(''); setPdfPassword(''); }}
                  aria-label="Cancel"
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportJson}
                  disabled={!legalBasis || exporting}
                  aria-label="Export JSON"
                >
                  Export JSON
                </Button>
                <Button
                  variant="default"
                  onClick={handleExportPdf}
                  disabled={!legalBasis || exporting}
                  aria-label="Export PDF"
                >
                  {exporting ? 'Exporting...' : 'Export PDF'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
