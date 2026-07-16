import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR, { mutate } from 'swr';
import useSWRMutation from 'swr/mutation';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { Search, Download, AlertTriangle } from 'lucide-react';
import { isOnline } from '../lib/sync';
import { queueFsmTransition } from '../lib/offline-queue';
import { PageShell } from '@/components/PageShell';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '../lib/auth-context';
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
  createdAt: string;
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
  const age = (ben.age as number) || 0;
  return {
    id: c.id as string,
    no: i + 1,
    surname: (ben.surname as string) || '',
    first: (ben.firstName as string) || '',
    middle: (ben.middleName as string) || '',
    gender: ((ben.gender as string) || '').trim(),
    ageRange: age ? (age < 18 ? '0-17' : age > 59 ? '60+' : '18-59') : '',
    category: ((c.serviceRequested as string[]) || []).join(', '),
    barangay: ((ben.address as string) || '').split(',').pop()?.trim() || '',
    remarks: (c.remarks as string) || '',
    date: c.updatedAt ? new Date(c.updatedAt as string).toLocaleString() : '',
    createdAt: (c.createdAt as string) || '',
    status: (c.status as string) || 'pending_assessment',
    controlNo: (c.controlNo as string) || '',
    slaOverdue: (c.slaOverdue as boolean) || false,
  };
}

export function CasesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [ageRangeFilter, setAgeRangeFilter] = useState('');
  const [slaFilter, setSlaFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // Per-action in-flight flags — preserves the existing per-row disabled-button behavior.
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { user } = useAuth();
  const role = user?.role || '';

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

  const filteredCases = cases.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      const fullName = `${c.surname} ${c.first} ${c.middle}`.toLowerCase();
      if (!fullName.includes(q)) return false;
    }
    if (barangayFilter && c.barangay !== barangayFilter) return false;
    if (categoryFilter && c.category !== categoryFilter) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    if (genderFilter && c.gender.toLowerCase() !== genderFilter.toLowerCase()) return false;
    if (ageRangeFilter && c.ageRange !== ageRangeFilter) return false;
    if (slaFilter === 'overdue' && !c.slaOverdue) return false;
    if (slaFilter === 'on_track' && c.slaOverdue) return false;
    if (dateFrom && c.createdAt) {
      const from = new Date(dateFrom + 'T00:00:00Z');
      if (new Date(c.createdAt) < from) return false;
    }
    if (dateTo && c.createdAt) {
      const to = new Date(dateTo + 'T23:59:59Z');
      if (new Date(c.createdAt) > to) return false;
    }
    return true;
  });

  function clearFilters() {
    setSearch('');
    setBarangayFilter('');
    setCategoryFilter('');
    setStatusFilter('');
    setGenderFilter('');
    setAgeRangeFilter('');
    setSlaFilter('');
    setDateFrom('');
    setDateTo('');
  }

  const hasAnyFilter = search || barangayFilter || categoryFilter || statusFilter || genderFilter || ageRangeFilter || slaFilter || dateFrom || dateTo;

  const uniqueBarangays = useMemo(() => [...new Set(cases.map(c => c.barangay).filter(Boolean))], [cases]);
  const uniqueCategories = useMemo(() => [...new Set(cases.map(c => c.category).filter(Boolean))], [cases]);
  const uniqueGenders = useMemo(() => [...new Set(cases.map(c => c.gender).filter(Boolean))], [cases]);
  const uniqueAgeRanges = useMemo(() => [...new Set(cases.map(c => c.ageRange).filter(Boolean))], [cases]);

  function exportCSV() {
    const headers = ['No.','Surname','First','Middle','Gender','Age Range','Category','Status','SLA','Barangay','Remarks','Date'];
    const rows = filteredCases.map(c => [c.no, c.surname, c.first, c.middle, c.gender, c.ageRange, c.category, STATUS_LABELS[c.status] || c.status, c.slaOverdue ? 'OVERDUE' : 'On Track', c.barangay, c.remarks, c.date]);
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
    { accessorKey: 'surname', header: 'Surname', cell: ({ row }) => <button className="font-medium text-primary hover:underline text-left" onClick={() => navigate(`/cases/${row.original.id}`)}>{row.original.surname}</button> },
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
        <span className="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
          On Track
        </span>
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
        <div className="flex items-center gap-2 flex-wrap">
          <select aria-label="Filter by barangay" className="flex h-10 w-40 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={barangayFilter} onChange={e => setBarangayFilter(e.target.value)}>
            <option value="">All Barangays</option>
            {uniqueBarangays.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select aria-label="Filter by category" className="flex h-10 w-44 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="">All Categories</option>
            {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select aria-label="Filter by status" className="flex h-10 w-36 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select aria-label="Filter by gender" className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={genderFilter} onChange={e => setGenderFilter(e.target.value)}>
            <option value="">All Genders</option>
            {uniqueGenders.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select aria-label="Filter by age range" className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={ageRangeFilter} onChange={e => setAgeRangeFilter(e.target.value)}>
            <option value="">All Ages</option>
            {uniqueAgeRanges.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select aria-label="Filter by SLA" className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={slaFilter} onChange={e => setSlaFilter(e.target.value)}>
            <option value="">All SLA</option>
            <option value="overdue">Overdue</option>
            <option value="on_track">On Track</option>
          </select>
          <Input type="date" aria-label="Date from" className="w-36" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <Input type="date" aria-label="Date to" className="w-36" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          {hasAnyFilter && (
            <Button variant="ghost" size="sm" onClick={clearFilters} aria-label="Clear filters">Clear</Button>
          )}
          <Button variant="default" size="sm" onClick={exportCSV} aria-label="Export CSV">
            <Download size={16} />
            Export CSV
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input type="text" aria-label="Search cases" placeholder="Search records..." className="w-48 pl-8" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Data table / Empty state */}
      {!loading && filteredCases.length === 0 ? (
        <EmptyState variant={hasAnyFilter ? 'no-results' : 'no-data'} />
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
