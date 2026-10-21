import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR, { useSWRConfig } from 'swr';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, FileSpreadsheet, Plus } from 'lucide-react';
import { toast } from 'sonner';
import i18n from '@/i18n';
import { api, downloadClientDedupOutput } from '../lib/api';
import { formatDate } from '../lib/format';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { DataTable } from '@/components/data-table/DataTable';
import { RowDecisionCard, type DedupCandidate, type DedupRow } from '@/components/dedup/RowDecisionCard';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/** One import run as returned by `GET /client-dedup/operations`. */
interface DedupOperation {
  id: string;
  source: string;
  status: 'defined' | 'reviewing' | 'finalizing' | 'finalized';
  createdAt: string;
  pending?: number;
  noMatch?: number;
  decided?: number;
  totalRows?: number;
}

interface OperationsResponse {
  data: DedupOperation[];
  total: number;
  page: number;
  limit: number;
}

interface OperationDetail extends DedupOperation {
  pending: number;
  disqualified: number;
  totalRows: number;
  /** Set by the worker when a batch fails; the operation returns to review. */
  finalizeError?: string | null;
  /** What the batch saved, persisted so a reload still shows the numbers. */
  finalizeSummary?: FinalizeSummary | null;
}

interface RowsResponse {
  data: DedupRow[];
  total: number;
  page: number;
  limit: number;
}

interface MatchesResponse {
  data: DedupCandidate[];
  total: number;
  page: number;
  limit: number;
}

/** What the finalize transaction reports back. */
interface FinalizeSummary {
  created: number;
  updated: number;
  deprioritized: number;
  barangayUpdates: number;
}

const t = i18n.t.bind(i18n);

const STATUS_LABELS: Record<DedupOperation['status'], string> = {
  defined: t('dedup.statusDefined', 'Defined'),
  reviewing: t('dedup.statusReviewing', 'Reviewing'),
  finalizing: t('dedup.statusFinalizing', 'Finalizing'),
  finalized: t('dedup.statusFinalized', 'Finalized'),
};

const STATUS_VARIANTS: Record<DedupOperation['status'], 'default' | 'secondary' | 'outline'> = {
  defined: 'outline',
  reviewing: 'default',
  finalizing: 'default',
  finalized: 'secondary',
};

export default function ClientDedupPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  // Creating a run lives at /client-dedup/new (ClientDedupNewPage) so the
  // define form is a real route: it survives reloads and the back button.
  // The review of a run lives at /client-dedup/:operationId for the same
  // reason — this page therefore only lists and reviews.
  if (id) {
    return <ReviewView operationId={id} onBack={() => navigate('/client-dedup')} />;
  }
  return (
    <OperationsList
      onDefine={() => navigate('/client-dedup/new')}
      onOpen={(operationId) => navigate(`/client-dedup/${operationId}`)}
    />
  );
}

function OperationsList({ onDefine, onOpen }: { onDefine: () => void; onOpen: (id: string) => void }) {
  const { data, isLoading } = useSWR<OperationsResponse>(
    ['clientDedup', 'operations'] as const,
    () => api.get<OperationsResponse>('/client-dedup/operations?page=1&limit=50'),
  );

  const columns = useMemo<ColumnDef<DedupOperation>[]>(
    () => [
      {
        accessorKey: 'source',
        header: t('dedup.colSource', 'Source'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{row.original.source}</span>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: t('dedup.colStatus', 'Status'),
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANTS[row.original.status]}>
            {STATUS_LABELS[row.original.status]}
          </Badge>
        ),
      },
      {
        id: 'progress',
        header: t('dedup.colProgress', 'Progress'),
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground">
            <div>{row.original.pending ?? 0} pending</div>
            <div>{row.original.totalRows ?? 0} rows</div>
          </div>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: t('dedup.colCreated', 'Created'),
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button size="sm" variant="outline" onClick={() => onOpen(row.original.id)}>
            {row.original.status === 'finalized' ? t('dedup.viewOutput', 'View output') : t('dedup.review', 'Review')}
          </Button>
        ),
      },
    ],
    [onOpen],
  );

  const operations = data?.data ?? [];

  return (
    <PageShell
      title="Client Deduplication"
      description="Import a client list, review candidate matches, and export the priority list."
      actions={
        <Button onClick={onDefine}>
          <Plus className="mr-2 h-4 w-4" />{t('dedup.newOperation', 'New deduplication')}</Button>
      }
    >
      {!isLoading && operations.length === 0 ? (
        /* First run: a bare "No results." table row tells nobody what this
           page is for. Guide the operator to the create route instead (same
           empty-state pattern as the announcements page). */
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileSpreadsheet size={20} className="text-muted-foreground" />
            </div>
            <h3 className="font-semibold font-heading">{t('dedup.emptyTitle', 'No import runs yet')}</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm mx-auto">
              {t(
                'dedup.emptyDesc',
                'A run imports a client list, matches it against previous servings, and ends with a priority list. Start one when the next batch arrives.',
              )}
            </p>
            <Button onClick={onDefine}>
              <Plus size={16} className="mr-1" />{t('dedup.newOperation', 'New deduplication')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={operations}
          rowCount={data?.total ?? 0}
          loading={isLoading}
          pagination={{ pageIndex: 0, pageSize: 50 }}
          sorting={[]}
        />
      )}
    </PageShell>
  );
}

/** Review grid: paginated rows; each row's candidates load lazily on expand. */
function ReviewView({ operationId, onBack }: { operationId: string; onBack: () => void }) {
  const { mutate } = useSWRConfig();
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [summary, setSummary] = useState<FinalizeSummary | null>(null);
  /** Seconds waited so far — a batch takes minutes; silence looks broken. */
  const [elapsed, setElapsed] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'matched' | 'no_match' | 'disqualified'>('all');
  // The two dedup stages: duplicates inside this import first, then matches
  // with KAPWA records. Rows can belong to both — the phase just changes what
  // is listed.
  const [phase, setPhase] = useState<'all' | 'intra_list' | 'db_match'>('all');

  const { data: detail } = useSWR<OperationDetail>(
    queryKeys.clientDedup.detail(operationId),
    () => api.get<OperationDetail>(`/client-dedup/operations/${operationId}`),
    // The finalize runs in the worker: while it does, keep the badge and the
    // button in step with the operation instead of showing a stale "Reviewing".
    { refreshInterval: (d) => (d?.status === 'finalizing' ? 3000 : 0) },
  );
  const { data: rowsData, isLoading } = useSWR(
    ['clientDedup', 'rows', operationId, pagination.pageIndex + 1, pagination.pageSize, reviewFilter, phase] as const,
    () =>
      api.get<RowsResponse>(
        `/client-dedup/operations/${operationId}/rows?page=${pagination.pageIndex + 1}&limit=${pagination.pageSize}` +
          (reviewFilter !== 'all' ? `&filter=${reviewFilter}` : '') +
          (phase !== 'all' ? `&phase=${phase}` : ''),
      ),
  );
  const rows = rowsData?.data ?? [];
  const expandedRow = rows.find((r) => r.id === expandedRowId) ?? null;
  const pendingCount = detail?.pending ?? 0;
  const disqualifiedCount = detail?.disqualified ?? 0;

  const refresh = () => mutate((key) => Array.isArray(key) && key[0] === 'clientDedup');

  /**
   * The endpoint queues the batch (202) and the worker runs it — a
   * whole-municipal-list import takes minutes and must not hold a request open.
   * Poll until the operation lands, showing the elapsed time meanwhile.
   */
  async function waitForFinalize(id: string): Promise<FinalizeSummary | null> {
    const STEP_MS = 3000;
    const MAX_MS = 15 * 60 * 1000;
    for (let waited = 0; waited <= MAX_MS; waited += STEP_MS) {
      const op = await api.get<OperationDetail>(`/client-dedup/operations/${id}`);
      if (op.finalizeError) throw new Error(op.finalizeError);
      if (op.status === 'finalized') return op.finalizeSummary ?? null;
      setElapsed(Math.round((waited + STEP_MS) / 1000));
      await new Promise((r) => setTimeout(r, STEP_MS));
    }
    throw new Error(t('dedup.finalizeSlow', 'Still running after 15 minutes — reopen this operation to check again.'));
  }

  async function finalize() {
    setFinalizing(true);
    setElapsed(0);
    try {
      await api.post(`/client-dedup/operations/${operationId}/finalize`, {});
      const result = await waitForFinalize(operationId);
      setSummary(result);
      toast.success(t('dedup.finalizeToast', 'Import finalized — the priority list is saved.'));
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Finalize failed');
    } finally {
      setFinalizing(false);
      setElapsed(0);
      setConfirmOpen(false);
    }
  }


  const columns = useMemo<ColumnDef<DedupRow>[]>(
    () => [
      {
        accessorKey: 'rowIndex',
        header: t('dedup.colIndex', '#'),
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.rowIndex}</span>,
      },
      {
        id: 'client',
        header: t('dedup.colClient', 'Client'),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">
              {[row.original.lastName, row.original.firstName].filter(Boolean).join(', ')}
              {row.original.middleName ? ` ${row.original.middleName}` : ''}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDate(row.original.dob)} · {row.original.barangay ?? '—'}
            </div>
          </div>
        ),
      },
      {
        id: 'status',
        header: t('dedup.colStatus', 'Status'),
        cell: ({ row }) => (
          <div className="space-y-1">
            <RowStatusChip row={row.original} />
            <CodeChip code={row.original.eligibilityCode} />
          </div>
        ),
      },
      {
        id: 'remarks',
        header: t('dedup.colRemarks', 'Remarks'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.remarks ?? '—'}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) =>
          row.original.status === 'no_match' ? null : (
            <Button size="sm" variant="outline" onClick={() => setExpandedRowId(row.original.id)}>
              Review matches
            </Button>
          ),
      },
    ],
    [],
  );

  if (summary || detail?.status === 'finalized') {
    return (
      <OutputView operationId={operationId} summary={summary} detail={detail} onBack={onBack} />
    );
  }

  return (
    <div data-testid="review-view">
      <PageShell
        title={detail?.source ?? t('dedup.review', 'Review')}
        description={detail ? `${detail.pending} pending · ${detail.totalRows} rows` : undefined}
        backTo={{ label: t('dedup.operations', 'Operations'), onClick: onBack }}
      >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Phase 1 first, phase 2 second — the process the review is named for. */}
          <Tabs
            value={phase}
            onValueChange={(v) => {
              setPhase(v as typeof phase);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          >
            <TabsList aria-label="Review phase">
              <TabsTrigger value="all">{t('dedup.filterAll', 'All rows')}</TabsTrigger>
              <TabsTrigger value="intra_list">{t('dedup.phaseIntra', '1 · Duplicates in this list')}</TabsTrigger>
              <TabsTrigger value="db_match">{t('dedup.phaseDb', '2 · KAPWA matches')}</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select
            value={reviewFilter}
            onValueChange={(value) => {
              setReviewFilter(value as typeof reviewFilter);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          >
            <SelectTrigger aria-label="Review filter" className="w-[15rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('dedup.filterAll', 'All rows')}</SelectItem>
              <SelectItem value="matched">{t('dedup.filterMatched', 'With matches')}</SelectItem>
              <SelectItem value="no_match">{t('dedup.filterNoMatch', 'No match only')}</SelectItem>
              <SelectItem value="disqualified">{t('dedup.filterDisqualified', 'Disqualified — review')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs text-muted-foreground">
          {rowsData?.total ?? 0} row{(rowsData?.total ?? 0) === 1 ? '' : 's'}
        </span>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        rowCount={rowsData?.total ?? 0}
        loading={isLoading}
        pagination={pagination}
        sorting={[]}
        onPaginationChange={setPagination}
      />
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur">
        <span className="text-sm text-muted-foreground">
          {detail?.status === 'finalizing'
            ? t('dedup.runningNow', 'The batch is running in the background{{elapsed}}.', {
                elapsed: elapsed ? ` — ${elapsed}s` : '',
              })
            : `${pendingCount} pending ${disqualifiedCount} disqualified`}
        </span>
        <Button
          onClick={() => setConfirmOpen(true)}
          disabled={pendingCount > 0 || disqualifiedCount > 0 || finalizing || detail?.status === 'finalizing'}
          title={
            pendingCount > 0 || disqualifiedCount > 0
              ? `${pendingCount} match${pendingCount === 1 ? '' : 'es'} pending and ${disqualifiedCount} disqualified row${disqualifiedCount === 1 ? '' : 's'} awaiting decision`
              : undefined
          }
        >
          {finalizing ? t('dedup.finalizing', 'Finalizing…') : t('dedup.finalize', 'Finalize & save priority list')}
        </Button>
      </div>

      {expandedRow && (
        <Dialog
          open={expandedRowId !== null}
          onOpenChange={(open) => {
            if (!open) setExpandedRowId(null);
          }}
        >
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Row {expandedRow.rowIndex} — {expandedRow.lastName ?? ''},{' '}
                {expandedRow.firstName ?? ''} {expandedRow.middleName ?? ''}
              </DialogTitle>
              <DialogDescription>
                {[formatDate(expandedRow.dob), expandedRow.barangay ?? '—'].join(' · ')}
                {expandedRow.remarks ? ` — ${expandedRow.remarks}` : ''}
              </DialogDescription>
            </DialogHeader>
            <ExpandedRowPanel
              operationId={operationId}
              row={expandedRow}
              onChanged={refresh}
              canRevert={detail?.status === 'reviewing'}
              embedded
            />
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dedup.finalizeConfirm', 'Finalize this import?')}</AlertDialogTitle>
            <AlertDialogDescription>
              New clients are saved, retained rows update the existing records, and deprioritized
              rows create nothing. The priority list Excel is written afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={finalize}>{t('dedup.finalizeAction', 'Finalize')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </PageShell>
    </div>
  );
}

function OutputView({
  operationId,
  summary,
  detail,
  onBack,
}: {
  operationId: string;
  summary: FinalizeSummary | null;
  detail?: OperationDetail;
  onBack: () => void;
}) {
  const [downloading, setDownloading] = useState(false);

  async function download() {
    setDownloading(true);
    try {
      await downloadClientDedupOutput(operationId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div data-testid="output-view">
      <PageShell
        title={detail?.source ?? 'Finalized import'}
        description={t('dedup.outputDesc', 'The priority list is written to Excel — download it below.')}
        backTo={{ label: t('dedup.operations', 'Operations'), onClick: onBack }}
      >
      <Card className="mx-auto w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-lg font-semibold leading-tight">{t('dedup.outputTitle', 'Priority list ready')}</CardTitle>
          <CardDescription>
            {summary
              ? t('dedup.outputSummaryDesc', 'What this batch saved or set aside.')
              : t('dedup.outputLegacyDesc', 'This import was finalized earlier. Download the stored priority list below.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {(summary ?? detail?.finalizeSummary) && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={t('dedup.statCreated', 'New records saved')} value={(summary ?? detail!.finalizeSummary)!.created} testId="stat-created" />
              <Stat label={t('dedup.statUpdated', 'Existing records updated')} value={(summary ?? detail!.finalizeSummary)!.updated} testId="stat-updated" />
              <Stat label={t('dedup.statDeprioritized', 'Rows deprioritized')} value={(summary ?? detail!.finalizeSummary)!.deprioritized} testId="stat-deprioritized" />
              <Stat label={t('dedup.statBarangay', 'Barangay updates')} value={(summary ?? detail!.finalizeSummary)!.barangayUpdates} testId="stat-barangay" />
            </div>
          )}
          <Button onClick={download} disabled={downloading}>
            <Download className="mr-2 h-4 w-4" />
            {downloading ? t('dedup.preparing', 'Preparing…') : t('dedup.download', 'Download priority list (.xlsx)')}
          </Button>
        </CardContent>
      </Card>
      </PageShell>
    </div>
  );
}

function Stat({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-2xl font-semibold" data-testid={testId}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function RowStatusChip({ row }: { row: DedupRow }) {
  // A disqualification IS a deprioritization: until the operator decides, it
  // reads t('dedup.chipDisq', 'Disqualified — review needed'); afterwards it reads 'Deprioritized'.
  const panReview =
    row.status === 'deprioritized' && row.eligibility === 'disqualified' && !row.eligibilityDecision;
  const config: Record<DedupRow['status'], { label: string; className: string }> = {
    no_match: { label: t('dedup.chipNoMatch', 'No match'), className: 'border-success/35 bg-alert-success-bg text-success-foreground' },
    pending: { label: t('dedup.chipPending', 'Pending review'), className: 'border-border bg-muted text-muted-foreground' },
    retained: { label: t('dedup.chipRetained', 'Retained'), className: 'border-success/35 bg-alert-success-bg text-success-foreground' },
    primary: { label: t('dedup.chipPrimary', 'Primary — kept'), className: 'border-badge-review-bg bg-badge-review-bg text-secondary-foreground' },
    deprioritized: {
      label: panReview ? t('dedup.chipDisq', 'Disqualified — review needed') : 'Deprioritized',
      className: panReview
        ? 'border-destructive/30 bg-destructive/10 text-destructive-foreground'
        : 'border-warning/35 bg-alert-error-bg text-warning-foreground',
    },
  };
  const { label, className } = config[row.status];
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

/**
 * The traffic-light chip on every row: the same codes the candidate cards use,
 * so the list is scannable without opening a card. Rows imported before the
 * code existed carry none.
 */
function CodeChip({ code }: { code?: string | null }) {
  if (!code) return null;
  const meta: Record<string, { label: string; className: string }> = {
    recent_intervention: { label: t('dedup.chipRecent', 'Served recently — review'), className: 'border-destructive/30 bg-destructive/10 text-destructive-foreground' },
    household_recent: { label: t('dedup.chipHousehold', 'Household served recently — review'), className: 'border-destructive/30 bg-destructive/10 text-destructive-foreground' },
    intra_list: { label: 'Duplicate in this list', className: 'border-warning/35 bg-alert-error-bg text-warning-foreground' },
    passed_30d: { label: 'Served earlier', className: 'border-warning/35 bg-alert-error-bg text-warning-foreground' },
    no_intervention: { label: t('dedup.chipNoIntervention', 'Matched — no prior service'), className: 'border-success/35 bg-alert-success-bg text-success-foreground' },
    new_client: { label: t('dedup.chipNewClient', 'New client'), className: 'border-success/35 bg-alert-success-bg text-success-foreground' },
  };
  const m = meta[code];
  if (!m) return null;
  return (
    <Badge variant="outline" className={m.className}>
      {m.label}
    </Badge>
  );
}

function ExpandedRowPanel({
  operationId,
  row,
  onChanged,
  canRevert = false,
  embedded = false,
}: {
  operationId: string;
  row: DedupRow;
  onChanged: () => Promise<unknown> | void;
  /** Decisions are reversible only while the operation is still in review. */
  canRevert?: boolean;
  embedded?: boolean;
}) {
  const { data, isLoading } = useSWR(
    ['clientDedup', 'matches', row.id] as const,
    () =>
      api.get<MatchesResponse>(
        `/client-dedup/operations/${operationId}/rows/${row.id}/matches?page=1&limit=20`,
      ),
  );
  return (
    <RowDecisionCard
      row={row}
      candidates={data?.data ?? []}
      loading={isLoading}
      embedded={embedded}
      onRevert={
        canRevert
          ? async (matchId: string) => {
              await api.post(`/client-dedup/operations/${operationId}/matches/${matchId}/revert`);
              toast.success(t('dedup.decisionReverted', 'Decision reverted — the match is pending again.'));
              await onChanged();
            }
          : undefined
      }
      onDecide={async (matchId: string, decision) => {
        const body =
          decision.kind === 'keep_row'
            ? { keep: 'import_row' }
            : decision.kind === 'keep_other_row'
              ? { keep: 'other_import_row', remark: decision.remark }
              : decision.kind === 'new_client'
                ? { samePerson: false, remark: decision.remark }
                : decision.kind === 'keep_here'
                  ? { samePerson: true, position: 'keep' }
                  : { samePerson: true, position: 'deprioritize', remark: decision.remark };
        await api.post(`/client-dedup/operations/${operationId}/matches/${matchId}/decision`, body);
        toast.success(
          decision.kind === 'keep_row'
            ? t('dedup.keptRow', 'This row is kept — the pair is set aside.')
            : decision.kind === 'keep_other_row'
              ? 'This row is set aside — the other import row is kept.'
              : decision.kind === 'new_client'
                ? 'Different person — the row is imported as a new client.'
                : decision.kind === 'keep_here'
                  ? 'Same person — the record is updated; the row keeps its position.'
                  : 'Same person — the row moves to the bottom of the priority list.',
        );
        await onChanged();
      }}
    />
  );
}
