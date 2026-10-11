import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR, { useSWRConfig } from 'swr';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, FileSpreadsheet, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import i18n from '@/i18n';
import { api, downloadClientDedupOutput } from '../lib/api';
import { formatDate } from '../lib/format';
import { INTERVENTION_TYPES } from '../lib/constants';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  disqualified: number;
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

const t = i18n.t.bind(i18n);

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

type View = { kind: 'list' } | { kind: 'define' };

const STATUS_LABELS: Record<DedupOperation['status'], string> = {
  defined: t('dedup.statusDefined', 'Defined'),
  reviewing: t('dedup.statusReviewing', 'Reviewing'),
  finalized: t('dedup.statusFinalized', 'Finalized'),
};

const STATUS_VARIANTS: Record<DedupOperation['status'], 'default' | 'secondary' | 'outline'> = {
  defined: 'outline',
  reviewing: 'default',
  finalized: 'secondary',
};

function emptyDraft() {
  return {
    source: '',
    // The intervention this list serves: an INTERVENTION_TYPES code, or a
    // custom label when 'Others' is chosen.
    interventionType: '',
    interventionTypeCustom: '',
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

const OTHER_TYPE = '__other__';

function typeLabel(code: string): string {
  return code.replace(/_/g, ' ').replace(/^./, (c: string) => c.toUpperCase());
}

export default function ClientDedupPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  // The list and the define wizard are local state; the REVIEW of an operation
  // lives at /client-dedup/:operationId so reloads, back/forward and deep
  // links keep the reviewer in place.
  const [formView, setFormView] = useState<'list' | 'define'>('list');

  if (formView === 'define') {
    return (
      <DefineUploadView
        onBack={() => setFormView('list')}
        onUploaded={(operationId) => {
          setFormView('list');
          navigate(`/client-dedup/${operationId}`);
        }}
      />
    );
  }
  if (id) {
    return <ReviewView operationId={id} onBack={() => navigate('/client-dedup')} />;
  }
  return (
    <OperationsList
      onDefine={() => setFormView('define')}
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

  return (
    <PageShell
      title="Client Deduplication"
      description="Import a client list, review candidate matches, and export the priority list."
      actions={
        <Button onClick={onDefine}>
          <Plus className="mr-2 h-4 w-4" />{t('dedup.newOperation', 'New deduplication')}</Button>
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

  const effectiveInterventionType =
    draft.interventionType === OTHER_TYPE ? draft.interventionTypeCustom.trim() : draft.interventionType;

  async function handleCreateAndUpload() {
    if (draft.source.trim() === '') {
      toast.error(t('dedup.nameListHint', 'Name this list — e.g. the file name or the batch it came from.'));
      return;
    }
    if (effectiveInterventionType === '') {
      toast.error(t('dedup.pickType', 'Pick the intervention type this list serves.'));
      return;
    }
    if (!file) {
      toast.error(t('dedup.pickFile', 'Choose the client list file to upload.'));
      return;
    }
    setBusy(true);
    try {
      let operationId = createdId;
      if (!operationId) {
        const created = await api.post<{ id: string }>('/client-dedup/operations', {
          source: draft.source.trim(),
          interventionType: effectiveInterventionType,
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
      toast.success(t('dedup.uploaded', 'Client list uploaded — review the candidate matches.'));
      onUploaded(operationId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('dedup.uploadFailed', 'Upload failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      title={t('dedup.newOperation', 'New deduplication')}
      description="An import run is a batch serving: it declares the intervention type, then matches clients against prior servings."
      backTo={{ label: t('dedup.operations', 'Operations'), onClick: onBack }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold leading-tight">{t('dedup.defineTitle', 'Define the client list')}</CardTitle>
          <CardDescription>
            Match each declared row to the column that carries it in the file. The six baseline
            rows are required; declare any extra field your list includes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="dedup-source">{t('dedup.listName', 'List name')}</Label>
            <Input
              id="dedup-source"
              value={draft.source}
              onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
              placeholder="e.g. Batch 2 — Poblacion, October"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dedup-type">{t('dedup.interventionType', 'Intervention type')}</Label>
            <Select
              value={draft.interventionType}
              onValueChange={(value) =>
                setDraft((d) => ({ ...d, interventionType: value, interventionTypeCustom: '' }))
              }
            >
              <SelectTrigger id="dedup-type" aria-label={t('dedup.interventionType', 'Intervention type')}>
                <SelectValue placeholder="Pick the intervention this list serves" />
              </SelectTrigger>
              <SelectContent className="max-h-72 overflow-y-auto">
                {INTERVENTION_TYPES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {typeLabel(code)}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER_TYPE}>{t('dedup.others', 'Others…')}</SelectItem>
              </SelectContent>
            </Select>
            {draft.interventionType === OTHER_TYPE && (
              <Input
                value={draft.interventionTypeCustom}
                onChange={(e) => setDraft((d) => ({ ...d, interventionTypeCustom: e.target.value }))}
                placeholder="e.g. Gift cards for senior citizens"
                aria-label="Other intervention type"
              />
            )}
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
              <span className="text-sm font-medium">{t('dedup.extraFields', 'Extra fields')}</span>
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
                <Plus className="mr-2 h-4 w-4" />{t('dedup.declareExtra', 'Declare extra field')}</Button>
            </div>
            {draft.extras.map((extra, index) => (
              <div className="grid gap-3 sm:grid-cols-4" key={index}>
                <Input
                  placeholder={t('dedup.fieldName', 'Field name')}
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
                    <SelectItem value="text">{t('dedup.kindText', 'Text')}</SelectItem>
                    <SelectItem value="date">{t('dedup.kindDate', 'Date')}</SelectItem>
                    <SelectItem value="number">{t('dedup.kindNumber', 'Number')}</SelectItem>
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
                    <SelectItem value="none">{t('dedup.kindPlain', 'Plain field')}</SelectItem>
                    <SelectItem value="phone">{t('dedup.kindPhone', 'Phone number')}</SelectItem>
                    <SelectItem value="email">{t('dedup.kindEmail', 'Email address')}</SelectItem>
                    <SelectItem value="philsys">{t('dedup.kindPhilSys', 'PhilSys number')}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input
                    placeholder={t('dedup.sourceColumn', 'Source column')}
                    value={extra.sourceColumn}
                    onChange={(e) => setExtra(index, { sourceColumn: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('dedup.removeExtra', 'Remove extra field')}
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
            <Label htmlFor="dedup-file">{t('dedup.fileLabel', 'Client list file')}</Label>
            <Input
              id="dedup-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">{t('dedup.fileHint', 'Excel or CSV. Rows missing Last Name, First Name, or Birthday are rejected.')}</p>
          </div>

          <Button onClick={handleCreateAndUpload} disabled={busy}>
            <Upload className="mr-2 h-4 w-4" />
            {busy ? t('dedup.uploading', 'Uploading…') : createdId ? t('dedup.retryUpload', 'Retry upload') : t('dedup.createUpload', 'Create & upload')}
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
  const [reviewFilter, setReviewFilter] = useState<'all' | 'matched' | 'no_match' | 'disqualified'>('all');
  // The two dedup stages: duplicates inside this import first, then matches
  // with KAPWA records. Rows can belong to both — the phase just changes what
  // is listed.
  const [phase, setPhase] = useState<'all' | 'intra_list' | 'db_match'>('all');

  const { data: detail } = useSWR<OperationDetail>(queryKeys.clientDedup.detail(operationId), () =>
    api.get<OperationDetail>(`/client-dedup/operations/${operationId}`),
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

  async function finalize() {
    setFinalizing(true);
    try {
      const result = await api.post<FinalizeSummary>(
        `/client-dedup/operations/${operationId}/finalize`,
        {},
      );
      setSummary(result);
      toast.success(t('dedup.finalizeToast', 'Import finalized — the priority list is saved.'));
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
              {row.original.dob ?? '—'} · {row.original.barangay ?? '—'}
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
          <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1" role="tablist" aria-label="Review phase">
            {([
              ['all', t('dedup.filterAll', 'All rows')],
              ['intra_list', t('dedup.phaseIntra', '1 · Duplicates in this list')],
              ['db_match', t('dedup.phaseDb', '2 · KAPWA matches')],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={phase === key}
                onClick={() => {
                  setPhase(key);
                  setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  phase === key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
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
          {pendingCount} pending {disqualifiedCount} disqualified
        </span>
        <Button
          onClick={() => setConfirmOpen(true)}
          disabled={pendingCount > 0 || disqualifiedCount > 0 || finalizing}
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
                {[expandedRow.dob ?? '—', expandedRow.barangay ?? '—'].join(' · ')}
                {expandedRow.remarks ? ` — ${expandedRow.remarks}` : ''}
              </DialogDescription>
            </DialogHeader>
            <ExpandedRowPanel operationId={operationId} row={expandedRow} onChanged={refresh} embedded />
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
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold leading-tight">{t('dedup.outputTitle', 'Priority list ready')}</CardTitle>
          <CardDescription>
            {summary
              ? t('dedup.outputSummaryDesc', 'What this batch saved or set aside.')
              : t('dedup.outputLegacyDesc', 'This import was finalized earlier. Download the stored priority list below.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {summary && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={t('dedup.statCreated', 'New records saved')} value={summary.created} testId="stat-created" />
              <Stat label={t('dedup.statUpdated', 'Existing records updated')} value={summary.updated} testId="stat-updated" />
              <Stat label={t('dedup.statDeprioritized', 'Rows deprioritized')} value={summary.deprioritized} testId="stat-deprioritized" />
              <Stat label={t('dedup.statBarangay', 'Barangay updates')} value={summary.barangayUpdates} testId="stat-barangay" />
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
  embedded = false,
}: {
  operationId: string;
  row: DedupRow;
  onChanged: () => Promise<unknown> | void;
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
      onEligibility={async (decision: 'waive' | 'confirm') => {
        await api.post(`/client-dedup/operations/${operationId}/rows/${row.id}/eligibility`, {
          decision,
        });
        toast.success(
          decision === 'waive'
            ? t('dedup.waiveRow', 'Row waived — it will be served this batch.')
            : t('dedup.confirmRow', 'Disqualification confirmed — the row stays deprioritized.'),
        );
        await onChanged();
      }}
      onMatchEligibility={async (matchId: string, decision: 'waive' | 'confirm') => {
        await api.post(`/client-dedup/operations/${operationId}/rows/${row.id}/eligibility`, {
          decision,
          matchId,
        });
        toast.success(decision === 'waive' ? t('dedup.waiveMatch', 'Match waived.') : t('dedup.confirmMatch', 'Match confirmed as disqualified.'));
        await onChanged();
      }}
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
