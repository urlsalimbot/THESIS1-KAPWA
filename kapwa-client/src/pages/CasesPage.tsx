import { useState, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import useSWRMutation from 'swr/mutation';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { Search, SlidersHorizontal, Download, AlertTriangle } from 'lucide-react';
import { isOnline } from '../lib/sync';
import { queueFsmTransition } from '../lib/offline-queue';
import { PageShell } from '@/components/PageShell';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { ColumnDef } from '@tanstack/react-table';

interface CaseRow {
  id: string;
  no: number;
  surname: string;
  first: string;
  middle: string;
  gender: string;
  ageRange: string;
  category: string;
  barangay: string;
  remarks: string;
  date: string;
  status: string;
  controlNo: string;
  slaOverdue?: boolean;
}

const STATUS_BADGES: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending_assessment: 'outline',
  in_review: 'secondary',
  approved: 'default',
  disbursed: 'secondary',
  closed: 'outline',
};

const STATUS_LABELS: Record<string, string> = {
  pending_assessment: 'Pending',
  in_review: 'In Review',
  approved: 'Approved',
  disbursed: 'Disbursed',
  closed: 'Closed',
};

function mapCaseRow(c: Record<string, unknown>, i: number): CaseRow {
  const ben = (c.beneficiary as Record<string, unknown>) || {};
  const dob = ben.dob as string;
  const age = dob ? new Date().getFullYear() - new Date(dob).getFullYear() : 0;
  return {
    id: c.id as string,
    no: i + 1,
    surname: (ben.surname as string) || '',
    first: (ben.firstName as string) || '',
    middle: (ben.middleName as string) || '',
    gender: (ben.gender as string) || '',
    ageRange: dob ? (age < 18 ? '0-17' : age > 59 ? '60+' : '18-59') : '',
    category: ((c.serviceRequested as string[]) || []).join(', '),
    barangay: ((ben.address as string) || '').split(',').pop()?.trim() || '',
    remarks: (c.remarks as string) || '',
    date: c.updatedAt ? new Date(c.updatedAt as string).toLocaleString() : '',
    status: (c.status as string) || 'pending_assessment',
    controlNo: (c.controlNo as string) || '',
    slaOverdue: (c.slaOverdue as boolean) || false,
  };
}

export function CasesPage() {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ barangay: false, status: false, category: false });
  // Per-action in-flight flags — preserves the existing per-row disabled-button behavior.
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const role = localStorage.getItem('kapwa_role') || '';

  // SWR list — api.get is bound globally in routes.tsx (no fetcher prop)
  const { data, isLoading } = useSWR<Record<string, unknown>[]>(queryKeys.cases.list());
  const cases = useMemo(() => (data || []).map(mapCaseRow), [data]);
  const lastSync = data ? Date.now() : null;
  const loading = isLoading;

  // 4 useSWRMutation hooks for state transitions — all keyed on queryKeys.cases.all
  // so the global mutate(queryKeys.cases.all) revalidation hits them too.
  const { trigger: requestReview } = useSWRMutation(
    queryKeys.cases.all,
    (_key, { arg }: { arg: { id: string } }) => api.put(`/cases/${arg.id}/request-review`),
  );
  const { trigger: disburseCase } = useSWRMutation(
    queryKeys.cases.all,
    (_key, { arg }: { arg: { id: string } }) => api.put(`/cases/${arg.id}/disburse`, { status: 'disbursed' }),
  );
  const { trigger: closeCase } = useSWRMutation(
    queryKeys.cases.all,
    (_key, { arg }: { arg: { id: string } }) => api.put(`/cases/${arg.id}/close`),
  );
  const { trigger: overrideCaseStatus } = useSWRMutation(
    queryKeys.cases.all,
    (_key, { arg }: { arg: { id: string; status: string; reason: string } }) =>
      api.put(`/cases/${arg.id}/override-status`, { status: arg.status, reason: arg.reason }),
  );

  async function handleAction(action: string, caseId: string) {
    setActionLoading(caseId);
    try {
      switch (action) {
        case 'request-review':
          if (isOnline()) {
            await requestReview({ id: caseId });
          } else {
            await queueFsmTransition(caseId, 'in_review');
            alert('Review request queued — will sync when online.');
          }
          break;
        case 'disburse':
          if (!isOnline()) {
            alert('This action requires an internet connection.');
            setActionLoading(null);
            return;
          }
          await disburseCase({ id: caseId });
          break;
        case 'close':
          if (!isOnline()) {
            alert('This action requires an internet connection.');
            setActionLoading(null);
            return;
          }
          await closeCase({ id: caseId });
          break;
        case 'override':
          if (!isOnline()) {
            alert('This action requires an internet connection.');
            setActionLoading(null);
            return;
          }
          await overrideCaseStatus({ id: caseId, status: 'approved', reason: 'admin override' });
          break;
      }
      // Revalidate all case-related queries — covers the list (CasesPage) and any
      // cross-page revalidation (Dashboard's recent-cases widget, etc.).
      await mutate(queryKeys.cases.all, undefined, { revalidate: true });
    } catch (err) {
      console.error(`Action ${action} failed:`, err);
      alert(`Action failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setActionLoading(null);
  }

  const toggleFilter = (key: keyof typeof filters) =>
    setFilters({ ...filters, [key]: !filters[key] });

  const filteredCases = cases.filter(c => {
    if (search && !c.surname.toLowerCase().includes(search.toLowerCase()) && !c.first.toLowerCase().includes(search.toLowerCase())) return false;
    if (filters.barangay && !c.barangay) return false;
    if (filters.category && !c.category) return false;
    return true;
  });

  const activeFilters = Object.values(filters).some(Boolean);

  function exportCSV() {
    const headers = ['No.','Surname','First','Middle','Gender','Age Range','Category','Status','SLA','Barangay','Remarks','Date'];
    const rows = filteredCases.map(c => [c.no, c.surname, c.first, c.middle, c.gender, c.ageRange, c.category, STATUS_LABELS[c.status] || c.status, c.slaOverdue ? 'OVERDUE' : '', c.barangay, c.remarks, c.date]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url; a.download = 'cases-export.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function renderActions(c: CaseRow) {
    const buttons: { action: string; label: string }[] = [];

    if (c.status === 'pending_assessment' && role === 'social_worker') {
      buttons.push({ action: 'request-review', label: 'Request Review' });
    }
    if (c.status === 'in_review' && role === 'admin') {
      // Approve button links to the existing approve flow — handled separately
    }
    if (c.status === 'approved' && role === 'admin') {
      buttons.push({ action: 'disburse', label: 'Disburse' });
    }
    if (c.status === 'disbursed' && (role === 'admin' || role === 'social_worker')) {
      buttons.push({ action: 'close', label: 'Close' });
    }

    if (buttons.length === 0) return <span className="text-muted-foreground text-xs">—</span>;

    return (
      <div className="flex gap-1">
        {buttons.map(b => (
          <Button
            key={b.action}
            variant="outline"
            size="sm"
            disabled={actionLoading === c.id}
            onClick={() => handleAction(b.action, c.id)}
          >
            {actionLoading === c.id ? '...' : b.label}
          </Button>
        ))}
      </div>
    );
  }

  const columns: ColumnDef<CaseRow>[] = [
    { accessorKey: 'no', header: 'No.', cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.original.no}</span> },
    { accessorKey: 'surname', header: 'Surname', cell: ({ row }) => <span className="font-medium">{row.original.surname}</span> },
    { accessorKey: 'first', header: 'First' },
    { accessorKey: 'middle', header: 'Middle' },
    { accessorKey: 'gender', header: 'Gender' },
    { accessorKey: 'ageRange', header: 'Age Range', cell: ({ row }) => <Badge variant="outline">{row.original.ageRange}</Badge> },
    { accessorKey: 'category', header: 'Category', cell: ({ row }) => <Badge variant="secondary">{row.original.category}</Badge> },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant={STATUS_BADGES[row.original.status] || 'outline'}>{STATUS_LABELS[row.original.status] || row.original.status}</Badge>,
    },
    {
      id: 'sla',
      header: 'SLA',
      cell: ({ row }) => row.original.slaOverdue ? (
        <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          <AlertTriangle size={12} /> OVERDUE
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
    },
    { accessorKey: 'barangay', header: 'Barangay' },
    { accessorKey: 'remarks', header: 'Remarks', cell: ({ row }) => <span className="text-xs">{row.original.remarks}</span> },
    { accessorKey: 'date', header: 'Date', cell: ({ row }) => <span className="text-xs text-muted-foreground tabular-nums">{row.original.date}</span> },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => renderActions(row.original),
    },
  ];

  if (loading) {
    return (
      <PageShell title="Case Tracker" description="Real-time view of processed interventions and logs.">
        <TableSkeleton rows={8} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Case Tracker"
      description="Real-time view of processed interventions and logs."
      cachedAt={lastSync ?? undefined}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" aria-label="Filter cases">
            <SlidersHorizontal size={16} />
            Filter
          </Button>
          <Button variant="default" size="sm" onClick={exportCSV} aria-label="Export CSV">
            <Download size={16} />
            Export CSV
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              aria-label="Search cases"
              placeholder="Search records..."
              className="w-48 pl-8"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button
          variant={filters.barangay ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleFilter('barangay')}
          aria-label="Filter by barangay"
        >
          By Barangay {filters.barangay && `(${new Set(cases.map(c => c.barangay).filter(Boolean)).size})`}
        </Button>
        <Button
          variant={filters.category ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleFilter('category')}
          aria-label="Filter by category"
        >
          By Category
        </Button>
        {activeFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters({ barangay: false, status: false, category: false })}
            aria-label="Clear filters"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Data table / Empty state */}
      {!loading && filteredCases.length === 0 ? (
        <EmptyState variant={search || activeFilters ? 'no-results' : 'no-data'} />
      ) : (
        <DataTable
          columns={columns}
          data={filteredCases}
          rowCount={filteredCases.length}
          pagination={{ pageIndex: 0, pageSize: 10 }}
          sorting={[]}
        />
      )}
    </PageShell>
  );
}
