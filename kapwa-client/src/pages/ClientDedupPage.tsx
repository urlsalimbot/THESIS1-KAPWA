import { useMemo, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, FileSpreadsheet, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

/** One import run as returned by `GET /client-dedup/operations`. */
interface DedupOperation {
  id: string;
  source: string;
  status: 'defined' | 'reviewing' | 'finalized';
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
  totalRows: number;
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

const BASELINE_FIELDS = [
  { key: 'lastName', label: 'Last Name column' },
  { key: 'firstName', label: 'First Name column' },
  { key: 'middleName', label: 'Middle Name column' },
  { key: 'birthDate', label: 'Birthday column' },
  { key: 'barangay', label: 'Barangay column' },
  { key: 'remarks', label: 'Remarks column' },
] as const;

type BaselineKey = (typeof BASELINE_FIELDS)[number]['key'];
type ExtraKind = 'text' | 'date' | 'number';
type ExtraIdentifier = 'phone' | 'email' | 'philsys';

interface ExtraField {
  name: string;
  kind: ExtraKind;
  identifier?: ExtraIdentifier;
  sourceColumn: string;
}

type View = { kind: 'list' } | { kind: 'define' } | { kind: 'review'; operationId: string };

const STATUS_LABELS: Record<DedupOperation['status'], string> = {
  defined: 'Defined',
  reviewing: 'Reviewing',
  finalized: 'Finalized',
};

const STATUS_VARIANTS: Record<DedupOperation['status'], 'default' | 'secondary' | 'outline'> = {
  defined: 'outline',
  reviewing: 'default',
  finalized: 'secondary',
};

function emptyDraft() {
  return {
    source: '',
    baseline: {
      lastName: 'Last Name',
      firstName: 'First Name',
      middleName: 'Middle Name',
      birthDate: 'Birthday',
      barangay: 'Barangay',
      remarks: 'Remarks',
    } as Record<BaselineKey, string>,
    extras: [] as ExtraField[],
  };
}

export default function ClientDedupPage() {
  const [view, setView] = useState<View>({ kind: 'list' });

  if (view.kind === 'define') {
    return (
      <DefineUploadView
        onBack={() => setView({ kind: 'list' })}
        onUploaded={(operationId) => setView({ kind: 'review', operationId })}
      />
    );
  }
  if (view.kind === 'review') {
    return <ReviewView operationId={view.operationId} onBack={() => setView({ kind: 'list' })} />;
  }
  return (
    <OperationsList
      onDefine={() => setView({ kind: 'define' })}
      onOpen={(operationId) => setView({ kind: 'review', operationId })}
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
        header: 'Source',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{row.original.source}</span>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANTS[row.original.status]}>
            {STATUS_LABELS[row.original.status]}
          </Badge>
        ),
      },
      {
        id: 'progress',
        header: 'Progress',
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground">
            <div>{row.original.pending ?? 0} pending</div>
            <div>{row.original.totalRows ?? 0} rows</div>
          </div>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button size="sm" variant="outline" onClick={() => onOpen(row.original.id)}>
            {row.original.status === 'finalized' ? 'View output' : 'Review'}
          </Button>
        ),
      },
    ],
    [onOpen],
  );

  return (
    <PageShell
      title="Client Deduplication"
      description="Import a client list, review candidate matches, and export the priority list."
      actions={
        <Button onClick={onDefine}>
          <Plus className="mr-2 h-4 w-4" /> New deduplication
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        rowCount={data?.total ?? 0}
        loading={isLoading}
        pagination={{ pageIndex: 0, pageSize: 50 }}
        sorting={[]}
      />
    </PageShell>
  );
}

function DefineUploadView({
  onBack,
  onUploaded,
}: {
  onBack: () => void;
  onUploaded: (operationId: string) => void;
}) {
  const [draft, setDraft] = useState(emptyDraft);
  const [file, setFile] = useState<File | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setBaseline = (key: BaselineKey, value: string) =>
    setDraft((d) => ({ ...d, baseline: { ...d.baseline, [key]: value } }));

  const setExtra = (index: number, patch: Partial<ExtraField>) =>
    setDraft((d) => ({
      ...d,
      extras: d.extras.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    }));

  async function handleCreateAndUpload() {
    if (draft.source.trim() === '') {
      toast.error('Name this list — e.g. the file name or the batch it came from.');
      return;
    }
    if (!file) {
      toast.error('Choose the client list file to upload.');
      return;
    }
    setBusy(true);
    try {
      let operationId = createdId;
      if (!operationId) {
        const created = await api.post<{ id: string }>('/client-dedup/operations', {
          source: draft.source.trim(),
          columnMap: {
            baseline: draft.baseline,
            extras: draft.extras.map((e) => ({
              name: e.name.trim(),
              kind: e.kind,
              ...(e.identifier ? { identifier: e.identifier } : {}),
              sourceColumn: e.sourceColumn.trim(),
            })),
          },
        });
        operationId = created.id;
        setCreatedId(operationId);
      }
      const formData = new FormData();
      formData.append('file', file);
      await api.upload(`/client-dedup/operations/${operationId}/upload`, formData);
      toast.success('Client list uploaded — review the candidate matches.');
      onUploaded(operationId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      title="Define the client list"
      description="Match each declared row to the column that carries it in the file. The six baseline rows are required; declare any extra field your list includes."
      backTo={{ label: 'Operations', onClick: onBack }}
    >
      <Card>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="dedup-source">List name</Label>
            <Input
              id="dedup-source"
              value={draft.source}
              onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
              placeholder="e.g. Batch 2 — Poblacion, October"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BASELINE_FIELDS.map((field) => (
              <div className="space-y-2" key={field.key}>
                <Label htmlFor={`dedup-col-${field.key}`}>{field.label}</Label>
                <Input
                  id={`dedup-col-${field.key}`}
                  value={draft.baseline[field.key]}
                  onChange={(e) => setBaseline(field.key, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Extra fields</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    extras: [...d.extras, { name: '', kind: 'text', sourceColumn: '' }],
                  }))
                }
              >
                <Plus className="mr-2 h-4 w-4" /> Declare extra field
              </Button>
            </div>
            {draft.extras.map((extra, index) => (
              <div className="grid gap-3 sm:grid-cols-4" key={index}>
                <Input
                  placeholder="Field name"
                  value={extra.name}
                  onChange={(e) => setExtra(index, { name: e.target.value })}
                />
                <Select
                  value={extra.kind}
                  onValueChange={(value) => setExtra(index, { kind: value as ExtraKind })}
                >
                  <SelectTrigger aria-label="Field kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={extra.identifier ?? 'none'}
                  onValueChange={(value) =>
                    setExtra(index, {
                      identifier: value === 'none' ? undefined : (value as ExtraIdentifier),
                    })
                  }
                >
                  <SelectTrigger aria-label="Field meaning">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Plain field</SelectItem>
                    <SelectItem value="phone">Phone number</SelectItem>
                    <SelectItem value="email">Email address</SelectItem>
                    <SelectItem value="philsys">PhilSys number</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input
                    placeholder="Source column"
                    value={extra.sourceColumn}
                    onChange={(e) => setExtra(index, { sourceColumn: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove extra field"
                    onClick={() =>
                      setDraft((d) => ({ ...d, extras: d.extras.filter((_, i) => i !== index) }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dedup-file">Client list file</Label>
            <Input
              id="dedup-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              Excel or CSV. Rows missing Last Name, First Name, or Birthday are rejected.
            </p>
          </div>

          <Button onClick={handleCreateAndUpload} disabled={busy}>
            <Upload className="mr-2 h-4 w-4" />
            {busy ? 'Uploading…' : createdId ? 'Retry upload' : 'Create & upload'}
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}

/** Review grid: paginated rows; each row's candidates load lazily on expand. */
function ReviewView({ operationId, onBack }: { operationId: string; onBack: () => void }) {
  const { mutate } = useSWRConfig();
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [summary, setSummary] = useState<FinalizeSummary | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const { data: detail } = useSWR<OperationDetail>(queryKeys.clientDedup.detail(operationId), () =>
    api.get<OperationDetail>(`/client-dedup/operations/${operationId}`),
  );
  const { data: rowsData, isLoading } = useSWR(
    ['clientDedup', 'rows', operationId, pagination.pageIndex + 1, pagination.pageSize] as const,
    () =>
      api.get<RowsResponse>(
        `/client-dedup/operations/${operationId}/rows?page=${pagination.pageIndex + 1}&limit=${pagination.pageSize}`,
      ),
  );
  const rows = rowsData?.data ?? [];
  const expandedRow = rows.find((r) => r.id === expandedRowId) ?? null;
  const pendingCount = detail?.pending ?? 0;

  const refresh = () => mutate((key) => Array.isArray(key) && key[0] === 'clientDedup');

  async function finalize() {
    setFinalizing(true);
    try {
      const result = await api.post<FinalizeSummary>(
        `/client-dedup/operations/${operationId}/finalize`,
        {},
      );
      setSummary(result);
      toast.success('Import finalized — the priority list is saved.');
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Finalize failed');
    } finally {
      setFinalizing(false);
      setConfirmOpen(false);
    }
  }


  const columns = useMemo<ColumnDef<DedupRow>[]>(
    () => [
      {
        accessorKey: 'rowIndex',
        header: '#',
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.rowIndex}</span>,
      },
      {
        id: 'client',
        header: 'Client',
        cell: ({ row }) => (
          <div>
            <div className="font-medium">
              {[row.original.lastName, row.original.firstName].filter(Boolean).join(', ')}
              {row.original.middleName ? ` ${row.original.middleName}` : ''}
            </div>
            <div className="text-xs text-muted-foreground">
              {row.original.dob ?? '—'} · {row.original.barangay ?? '—'}
            </div>
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <RowStatusChip status={row.original.status} />,
      },
      {
        id: 'remarks',
        header: 'Remarks',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.remarks ?? '—'}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) =>
          row.original.status === 'no_match' ? null : (
            <Button
              size="sm"
              variant={expandedRowId === row.original.id ? 'secondary' : 'outline'}
              onClick={() =>
                setExpandedRowId(expandedRowId === row.original.id ? null : row.original.id)
              }
            >
              {expandedRowId === row.original.id ? 'Close' : 'Review matches'}
            </Button>
          ),
      },
    ],
    [expandedRowId],
  );

  if (summary || detail?.status === 'finalized') {
    return (
      <OutputView operationId={operationId} summary={summary} detail={detail} onBack={onBack} />
    );
  }

  return (
    <div data-testid="review-view">
      <PageShell
        title={detail?.source ?? 'Review'}
        description={detail ? `${detail.pending} pending · ${detail.totalRows} rows` : undefined}
        backTo={{ label: 'Operations', onClick: onBack }}
      >
      <DataTable
        columns={columns}
        data={rows}
        rowCount={rowsData?.total ?? 0}
        loading={isLoading}
        pagination={pagination}
        sorting={[]}
        onPaginationChange={setPagination}
      />
      {expandedRow && (
        <ExpandedRowPanel operationId={operationId} row={expandedRow} onChanged={refresh} />
      )}

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur">
        <span className="text-sm text-muted-foreground">
          {pendingCount} pending decision{pendingCount === 1 ? '' : 's'}
        </span>
        <Button
          onClick={() => setConfirmOpen(true)}
          disabled={pendingCount > 0 || finalizing}
          title={
            pendingCount > 0
              ? `${pendingCount} match${pendingCount === 1 ? '' : 'es'} still pending — decide every one before finalizing`
              : undefined
          }
        >
          {finalizing ? 'Finalizing…' : 'Finalize & save priority list'}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalize this import?</AlertDialogTitle>
            <AlertDialogDescription>
              New clients are saved, retained rows update the existing records, and deprioritized
              rows create nothing. The priority list Excel is written afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={finalize}>Finalize</AlertDialogAction>
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
        title="Priority list ready"
        description={detail?.source ?? 'Finalized import'}
        backTo={{ label: 'Operations', onClick: onBack }}
      >
      <Card>
        <CardContent className="space-y-4">
          {summary ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="New records saved" value={summary.created} testId="stat-created" />
              <Stat label="Existing records updated" value={summary.updated} testId="stat-updated" />
              <Stat label="Rows deprioritized" value={summary.deprioritized} testId="stat-deprioritized" />
              <Stat label="Barangay updates" value={summary.barangayUpdates} testId="stat-barangay" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This import was finalized earlier. Download the stored priority list below.
            </p>
          )}
          <Button onClick={download} disabled={downloading}>
            <Download className="mr-2 h-4 w-4" />
            {downloading ? 'Preparing…' : 'Download priority list (.xlsx)'}
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

function RowStatusChip({ status }: { status: DedupRow['status'] }) {
  const config: Record<DedupRow['status'], { label: string; className: string }> = {
    no_match: { label: 'No match', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    pending: { label: 'Pending review', className: 'border-slate-200 bg-slate-100 text-slate-700' },
    retained: { label: 'Retained', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    primary: { label: 'Primary — kept', className: 'border-sky-200 bg-sky-50 text-sky-700' },
    deprioritized: { label: 'Deprioritized', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  };
  const { label, className } = config[status];
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

function ExpandedRowPanel({
  operationId,
  row,
  onChanged,
}: {
  operationId: string;
  row: DedupRow;
  onChanged: () => Promise<unknown> | void;
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
      onDecide={async (matchId, keep, remark) => {
        await api.post(
          `/client-dedup/operations/${operationId}/matches/${matchId}/decision`,
          remark ? { keep, remark } : { keep },
        );
        toast.success(keep === 'import_row' ? 'Row retained.' : 'Duplicate deprioritized.');
        await onChanged();
      }}
      onRevert={async (matchId) => {
        await api.post(`/client-dedup/operations/${operationId}/matches/${matchId}/revert`);
        toast.success('Decision reverted.');
        await onChanged();
      }}
    />
  );
}
