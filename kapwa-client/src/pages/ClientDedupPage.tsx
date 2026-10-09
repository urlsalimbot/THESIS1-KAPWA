import { useMemo, useState } from 'react';
import useSWR from 'swr';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, FileSpreadsheet, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import { queryKeys } from '../lib/query-keys';
import { DataTable } from '@/components/data-table/DataTable';
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
  totalRows: number;
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Client Deduplication</h1>
          <p className="text-sm text-muted-foreground">
            Import a client list, review candidate matches, and export the priority list.
          </p>
        </div>
        <Button onClick={onDefine}>
          <Plus className="mr-2 h-4 w-4" /> New deduplication
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        rowCount={data?.total ?? 0}
        loading={isLoading}
        pagination={{ pageIndex: 0, pageSize: 50 }}
        sorting={[]}
      />
    </div>
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
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to operations
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Define the client list</CardTitle>
          <CardDescription>
            Match each declared row to the column that carries it in the file. The six baseline rows are
            required; declare any extra field your list includes.
          </CardDescription>
        </CardHeader>
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
    </div>
  );
}

/** Review shell — the candidate grid and decisions land here (Task 12). */
function ReviewView({ operationId, onBack }: { operationId: string; onBack: () => void }) {
  const { data } = useSWR<OperationDetail>(queryKeys.clientDedup.detail(operationId));
  return (
    <div className="space-y-4" data-testid="review-view">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to operations
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{data?.source ?? 'Review'}</CardTitle>
          <CardDescription>
            {data ? `${data.pending} pending · ${data.totalRows} rows` : 'Loading review…'}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The candidate matches for each row load here.
        </CardContent>
      </Card>
    </div>
  );
}
