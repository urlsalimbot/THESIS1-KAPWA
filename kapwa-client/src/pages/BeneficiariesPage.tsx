import { BARANGAYS } from '../lib/constants';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Search, Loader2 } from 'lucide-react';
import useSWR from 'swr';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';

const CATEGORIES = ['All Categories', 'Senior', 'PWD', 'Child', 'Solo Parent', 'Indigenous', 'Others'];

interface Beneficiary { id: string; name: string; age: number; barangay: string; householdSize: number; programs: string[]; status: string; }

const statusBadgeVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  active: 'default',
  inactive: 'secondary',
  revoked: 'destructive',
};

function BeneficiaryActions({ id }: { id: string }) {
  const nav = useNavigate();
  return (
    <Button variant="ghost" size="sm" onClick={() => nav(`/beneficiaries/${id}`)} aria-label="View Beneficiary">
      <Eye size={14} className="mr-1" /> View
    </Button>
  );
}

function mapBeneficiary(b: Record<string, unknown>): Beneficiary {
  return {
    id: b.id as string,
    name: `${(b.firstName as string) || ''} ${(b.surname as string) || ''}`.trim(),
    age: b.dob ? new Date().getFullYear() - new Date(b.dob as string).getFullYear() : 0,
    barangay: ((b.address as string) || '').split(',').pop()?.trim() || '',
    householdSize: ((b.household as Record<string, unknown>)?.familyMembers as Array<unknown>)?.length || 1,
    programs: (b.programs as string[]) || [],
    status: (b.consentStatus as string) || 'active',
  };
}

const beneficiaryColumns: ColumnDef<Beneficiary>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'age', header: 'Age', cell: ({ row }) => <Badge variant="outline">{row.original.age}</Badge> },
  { accessorKey: 'barangay', header: 'Barangay' },
  { accessorKey: 'householdSize', header: 'Household', cell: ({ row }) => <span>{row.original.householdSize} members</span> },
  {
    accessorKey: 'programs',
    header: 'Programs',
    cell: ({ row }) => (
      <div className="flex gap-1 flex-wrap">
        {row.original.programs.map(p => <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>)}
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <Badge variant={statusBadgeVariant[row.original.status] || 'outline'}>{row.original.status}</Badge>,
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => <BeneficiaryActions id={row.original.id} />,
  },
];

function FilterBar({ searchInput, onSearchChange, categoryFilter, onCategoryChange, barangayFilter, onBarangayChange }: {
  searchInput: string;
  onSearchChange: (v: string) => void;
  categoryFilter: string;
  onCategoryChange: (v: string) => void;
  barangayFilter: string;
  onBarangayChange: (v: string) => void;
}) {
  const nav = useNavigate();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button variant="default" size="sm" onClick={() => nav('/intake')} aria-label="+ New Beneficiary">+ New Beneficiary</Button>
        <Button variant="outline" size="sm" aria-label="Import CSV">Import CSV</Button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            aria-label="Search beneficiaries"
            placeholder="Search by name..."
            className="w-48 pl-8"
            value={searchInput}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-muted-foreground font-medium">Category</label>
          <select
            aria-label="Filter by category"
            className="flex h-10 w-36 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={categoryFilter}
            onChange={e => onCategoryChange(e.target.value)}
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c === 'All Categories' ? '' : c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-muted-foreground font-medium">Barangay</label>
          <select
            aria-label="Filter by barangay"
            className="flex h-10 w-40 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={barangayFilter}
            onChange={e => onBarangayChange(e.target.value)}
          >
            <option value="all">All Barangays</option>
            {BARANGAYS.map(b => <option key={b}>{b}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

export function BeneficiariesPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('all');

  // Debounce search input — 300ms delay before triggering a key change.
  // SWR doesn't debounce; we debounce the key here.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Build the SWR key from the debounced inputs. The key is reference-stable
  // via the queryKeys factory memoization.
  const params = {
    search: debouncedSearch || undefined,
    category: categoryFilter || undefined,
    barangay: barangayFilter === 'all' ? undefined : barangayFilter,
  };
  const swrKey = queryKeys.beneficiaries.list(params);
  const { data, isLoading, isValidating } = useSWR<Record<string, unknown>[]>(swrKey, {
    keepPreviousData: true,
  });

  // Map raw data → typed Beneficiary[] (memoized for React.memo compatibility)
  const beneficiaries = useMemo(() => (data || []).map(mapBeneficiary), [data]);
  const lastSync = data ? Date.now() : null;

  const loading = isLoading;
  const fetching = isValidating;
  const canShowResults = !loading && !fetching && beneficiaries.length > 0;

  if (loading) {
    return (
      <PageShell title="Beneficiaries" description="Manage beneficiary records and household data">
        <TableSkeleton rows={8} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Beneficiaries"
      description="Manage beneficiary records and household data"
      cachedAt={lastSync ?? undefined}
    >
      <FilterBar
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        barangayFilter={barangayFilter}
        onBarangayChange={setBarangayFilter}
      />

      {/* Results count / loading indicator */}
      {canShowResults && (
        <div className="text-sm text-muted-foreground flex items-center gap-1">
          {fetching && <Loader2 size={14} className="animate-spin" />}
          {!fetching && `Showing ${beneficiaries.length} result${beneficiaries.length !== 1 ? 's' : ''}`}
          {!fetching && debouncedSearch && ` for "${debouncedSearch}"`}
        </div>
      )}

      {/* Empty state */}
      {!loading && !fetching && beneficiaries.length === 0 ? (
        <EmptyState variant={searchInput ? 'no-results' : 'no-data'} />
      ) : (
        <DataTable
          columns={beneficiaryColumns}
          data={beneficiaries}
          rowCount={beneficiaries.length}
          pagination={pagination}
          onPaginationChange={setPagination}
          sorting={[]}
        />
      )}
    </PageShell>
  );
}
