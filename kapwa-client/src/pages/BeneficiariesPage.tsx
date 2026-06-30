import { BARANGAYS } from '../lib/constants';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Search, Loader2 } from 'lucide-react';
import { getBeneficiaries } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { ColumnDef } from '@tanstack/react-table';

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

const beneficiaryColumns: ColumnDef<Beneficiary>[] = [
  { accessorKey: 'id', header: 'ID', cell: ({ row }) => <span className="font-medium">{row.original.id}</span> },
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

export function BeneficiariesPage() {
  const navigate = useNavigate();
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);

  // Debounce search input — 300ms delay before triggering API call
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch beneficiaries when debounced search, category, or barangay changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setFetching(true);
      try {
        const params: Record<string, string> = {};
        if (debouncedSearch) params.search = debouncedSearch;
        if (categoryFilter) params.category = categoryFilter;
        if (barangayFilter && barangayFilter !== 'all') params.barangay = barangayFilter;

        const hasParams = Object.keys(params).length > 0;
        const data = await getBeneficiaries(hasParams ? params : undefined);
        if (cancelled) return;
        const mapped: Beneficiary[] = (data || []).map((b: Record<string, unknown>) => ({
          id: b.id as string,
          name: `${b.firstName as string || ''} ${b.surname as string || ''}`.trim(),
          age: b.dob ? new Date().getFullYear() - new Date(b.dob as string).getFullYear() : 0,
          barangay: ((b.address as string) || '')?.split(',').pop()?.trim() || '',
          householdSize: ((b.household as Record<string, unknown>)?.familyMembers as Array<unknown>)?.length || 1,
          programs: b.programs as string[] || [],
          status: b.consentStatus as string || 'active',
        }));
        setBeneficiaries(mapped);
        setLastSync(Date.now());
      } catch {
        if (!cancelled) setBeneficiaries([]);
      }
      if (!cancelled) {
        setLoading(false);
        setFetching(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [debouncedSearch, categoryFilter, barangayFilter]);

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
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={() => navigate('/intake')} aria-label="+ New Beneficiary">+ New Beneficiary</Button>
          <Button variant="outline" size="sm" aria-label="Import CSV">Import CSV</Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search input with icon */}
          <div className="relative">
            <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              aria-label="Search beneficiaries"
              placeholder="Search by name..."
              className="w-48 pl-8"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>
          {/* Category dropdown */}
          <select
            aria-label="Filter by category"
            className="flex h-10 w-36 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c === 'All Categories' ? '' : c}>{c}</option>
            ))}
          </select>
          {/* Barangay dropdown */}
          <select
            aria-label="Filter by barangay"
            className="flex h-10 w-40 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={barangayFilter}
            onChange={e => setBarangayFilter(e.target.value)}
          >
            <option value="all">All Barangays</option>
            {BARANGAYS.map(b => <option key={b}>{b}</option>)}
          </select>
        </div>
      </div>

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
          pagination={{ pageIndex: 0, pageSize: 10 }}
          sorting={[]}
        />
      )}
    </PageShell>
  );
}
