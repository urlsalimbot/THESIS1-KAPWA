import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR, { mutate } from 'swr';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { Search, Download, AlertTriangle } from 'lucide-react';
import { useCaseFilters } from '../hooks/useCaseFilters';
import { useCaseActions } from '../hooks/useCaseActions';
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

function FilterSelect({ label, value, onChange, options, className }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; className?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-xs text-muted-foreground font-medium">{label}</label>
      <select aria-label={label} className={`flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className || ''}`}
        value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ActionsCell({ c, actionLoading, onAction }: {
  c: CaseRow; actionLoading: string | null; onAction: (action: string, id: string) => void;
}) {
  const { user } = useAuth();
  const role = user?.role || '';
  const buttons: { action: string; label: string }[] = [];

  if (c.status === 'pending_assessment' && role === 'social_worker') {
    buttons.push({ action: 'request-review', label: 'Request Review' });
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
        <Button key={b.action} variant="outline" size="sm"
          disabled={actionLoading === c.id}
          onClick={() => onAction(b.action, c.id)}>
          {actionLoading === c.id ? '...' : b.label}
        </Button>
      ))}
    </div>
  );
}

function exportCSV(rows: CaseRow[]) {
  const headers = ['No.','Surname','First','Middle','Gender','Age Range','Category','Status','SLA','Barangay','Remarks','Date'];
  const data = rows.map(c => [c.no, c.surname, c.first, c.middle, c.gender, c.ageRange, c.category, STATUS_LABELS[c.status] || c.status, c.slaOverdue ? 'OVERDUE' : 'On Track', c.barangay, c.remarks, c.date]);
  const csv = [headers, ...data].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url; a.download = 'cases-export.csv'; a.click();
  URL.revokeObjectURL(url);
}

export function CasesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { actionLoading, handleAction } = useCaseActions();

  const { data, isLoading } = useSWR<Record<string, unknown>[]>(queryKeys.cases.list());
  const cases = useMemo(() => (data || []).map(mapCaseRow), [data]);
  const lastSync = data ? Date.now() : null;

  const filters = useCaseFilters(cases);

  const columns: ColumnDef<CaseRow>[] = [
    { accessorKey: 'no', header: 'No.', cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.original.no}</span> },
    { accessorKey: 'surname', header: 'Surname', cell: ({ row }) => <button className="font-medium text-primary hover:underline text-left" onClick={() => navigate(`/cases/${row.original.id}`)}>{row.original.surname}</button> },
    { accessorKey: 'first', header: 'First' },
    { accessorKey: 'middle', header: 'Middle' },
    { accessorKey: 'gender', header: 'Gender' },
    { accessorKey: 'ageRange', header: 'Age Range', cell: ({ row }) => <Badge variant="outline">{row.original.ageRange}</Badge> },
    { accessorKey: 'category', header: 'Category', cell: ({ row }) => <Badge variant="secondary">{row.original.category}</Badge> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={STATUS_BADGES[row.original.status] || 'outline'}>{STATUS_LABELS[row.original.status] || row.original.status}</Badge> },
    { id: 'sla', header: 'SLA', cell: ({ row }) => row.original.slaOverdue ? (
      <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        <AlertTriangle size={12} /> OVERDUE
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">On Track</span>
    )},
    { accessorKey: 'barangay', header: 'Barangay' },
    { accessorKey: 'remarks', header: 'Remarks', cell: ({ row }) => <span className="text-xs">{row.original.remarks}</span> },
    { accessorKey: 'date', header: 'Date', cell: ({ row }) => <span className="text-xs text-muted-foreground tabular-nums">{row.original.date}</span> },
    { id: 'actions', header: 'Actions', cell: ({ row }) => <ActionsCell c={row.original} actionLoading={actionLoading} onAction={handleAction} /> },
  ];

  if (isLoading) {
    return (
      <PageShell title="Case Tracker" description="Real-time view of processed interventions and logs.">
        <TableSkeleton rows={8} />
      </PageShell>
    );
  }

  return (
    <PageShell title="Case Tracker" description="Real-time view of processed interventions and logs." cachedAt={lastSync ?? undefined}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <FilterSelect label="Barangay" value={filters.barangayFilter} onChange={filters.setBarangayFilter}
            options={[{ value: '', label: 'All Barangays' }, ...filters.uniqueBarangays.map(b => ({ value: b, label: b }))]} className="w-40" />
          <FilterSelect label="Category" value={filters.categoryFilter} onChange={filters.setCategoryFilter}
            options={[{ value: '', label: 'All Categories' }, ...filters.uniqueCategories.map(c => ({ value: c, label: c }))]} className="w-44" />
          <FilterSelect label="Status" value={filters.statusFilter} onChange={filters.setStatusFilter}
            options={[{ value: '', label: 'All Statuses' }, ...Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))]} className="w-36" />
          <FilterSelect label="Gender" value={filters.genderFilter} onChange={filters.setGenderFilter}
            options={[{ value: '', label: 'All Genders' }, ...filters.uniqueGenders.map(g => ({ value: g, label: g }))]} className="w-32" />
          <FilterSelect label="Age Range" value={filters.ageRangeFilter} onChange={filters.setAgeRangeFilter}
            options={[{ value: '', label: 'All Ages' }, ...filters.uniqueAgeRanges.map(a => ({ value: a, label: a }))]} className="w-32" />
          <FilterSelect label="SLA" value={filters.slaFilter} onChange={filters.setSlaFilter}
            options={[{ value: '', label: 'All SLA' }, { value: 'overdue', label: 'Overdue' }, { value: 'on_track', label: 'On Track' }]} className="w-32" />
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-muted-foreground font-medium">Date From</label>
            <Input type="date" aria-label="Date from" className="w-36" value={filters.dateFrom} onChange={e => filters.setDateFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-muted-foreground font-medium">Date To</label>
            <Input type="date" aria-label="Date to" className="w-36" value={filters.dateTo} onChange={e => filters.setDateTo(e.target.value)} />
          </div>
          {filters.hasAnyFilter && (
            <Button variant="ghost" size="sm" onClick={filters.clearFilters} aria-label="Clear filters">Clear</Button>
          )}
          <Button variant="default" size="sm" onClick={() => exportCSV(filters.filteredCases)} aria-label="Export CSV">
            <Download size={16} /> Export CSV
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input type="text" aria-label="Search cases" placeholder="Search records..." className="w-48 pl-8" value={filters.search} onChange={e => filters.setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {!isLoading && filters.filteredCases.length === 0 ? (
        <EmptyState variant={filters.hasAnyFilter ? 'no-results' : 'no-data'} />
      ) : (
        <DataTable columns={columns} data={filters.filteredCases} rowCount={filters.filteredCases.length}
          pagination={filters.pagination} onPaginationChange={filters.setPagination} sorting={[]} />
      )}
    </PageShell>
  );
}
