import { BARANGAYS, CLIENT_CATEGORIES } from '../lib/constants';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { categoryLabel } from '@/i18n/display';
import { Eye, Search, Loader2 } from 'lucide-react';
import useSWR from 'swr';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { ColumnDef, PaginationState, Updater } from '@tanstack/react-table';

interface Beneficiary { id: string; name: string; age: number; barangay: string; householdSize: number; category: string; status: string; }

const statusBadgeVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  active: 'default',
  inactive: 'secondary',
  revoked: 'destructive',
};

function BeneficiaryActions({ id }: { id: string }) {
  const nav = useNavigate();
  const { t } = useTranslation();
  return (
    <Button variant="secondary" size="sm" onClick={() => nav(`/beneficiaries/${id}`)} aria-label={t('beneficiaries.viewBeneficiary', 'View Beneficiary')}>
      <Eye size={14} className="mr-1" /> {t('beneficiaries.view', 'View')}
    </Button>
  );
}

function mapBeneficiary(b: Record<string, unknown>): Beneficiary {
  return {
    id: b.id as string,
    name: `${(b.firstName as string) || ''} ${(b.surname as string) || ''}`.trim(),
    age: b.dob ? new Date().getFullYear() - new Date(b.dob as string).getFullYear() : 0,
    barangay: ((b.address as string) || '').split(',').pop()?.trim() || '',
    householdSize: ((b.household as Record<string, unknown>)?.familyMemberCount as number) || 1,
    category: (b.category as string) || '',
    status: (b.consentStatus as string) || 'active',
  };
}

const makeBeneficiaryColumns = (t: TFunction): ColumnDef<Beneficiary>[] => [
  { accessorKey: 'name', header: t('beneficiaries.name', 'Name') },
  { accessorKey: 'age', header: t('beneficiaries.age', 'Age'), cell: ({ row }) => <Badge variant="outline">{row.original.age}</Badge> },
  { accessorKey: 'barangay', header: t('beneficiaries.barangay', 'Barangay') },
  { accessorKey: 'householdSize', header: t('beneficiaries.household', 'Household'), cell: ({ row }) => <span>{t('beneficiaries.membersCount', '{{count}} member', { count: row.original.householdSize })}</span> },
  {
    accessorKey: 'category',
    header: t('beneficiaries.clientCategory', 'Client Category'),
    cell: ({ row }) => <Badge variant="secondary" className="text-xs">{row.original.category ? categoryLabel(t, row.original.category) : '—'}</Badge>,
  },
  {
    accessorKey: 'status',
    header: t('beneficiaries.status', 'Status'),
    cell: ({ row }) => <Badge variant={statusBadgeVariant[row.original.status] || 'outline'}>{row.original.status}</Badge>,
  },
  {
    id: 'actions',
    header: t('beneficiaries.actions', 'Actions'),
    cell: ({ row }) => <BeneficiaryActions id={row.original.id} />,
  },
];

function FilterBar({ searchInput, onSearchChange, onSearch, categoryFilter, onCategoryChange, barangayFilter, onBarangayChange }: {
  searchInput: string;
  onSearchChange: (v: string) => void;
  onSearch: () => void;
  categoryFilter: string;
  onCategoryChange: (v: string) => void;
  barangayFilter: string;
  onBarangayChange: (v: string) => void;
}) {
  const nav = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button variant="default" size="sm" onClick={() => nav('/intake')} aria-label={t('beneficiaries.newBeneficiaryAria', '+ New Beneficiary')}>{t('beneficiaries.newBeneficiary', '+ New Beneficiary')}</Button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            aria-label={t('beneficiaries.searchAria', 'Search beneficiaries')}
            placeholder={t('beneficiaries.searchPlaceholder', 'Search by name...')}
            className="w-48 pl-8"
            value={searchInput}
            onChange={e => onSearchChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onSearch(); }}
          />
        </div>
        <Button size="sm" onClick={onSearch}>{t('beneficiaries.search', 'Search')}</Button>
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-muted-foreground font-medium">{t('beneficiaries.category', 'Category')}</label>
          <select
            aria-label={t('beneficiaries.filterByCategory', 'Filter by category')}
            className="flex h-10 w-36 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={categoryFilter}
            onChange={e => onCategoryChange(e.target.value)}
          >
            <option value="">{t('beneficiaries.allCategories', 'All Categories')}</option>
            {CLIENT_CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-muted-foreground font-medium">{t('beneficiaries.barangay', 'Barangay')}</label>
          <select
            aria-label={t('beneficiaries.filterByBarangay', 'Filter by barangay')}
            className="flex h-10 w-40 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={barangayFilter}
            onChange={e => onBarangayChange(e.target.value)}
          >
            <option value="all">{t('beneficiaries.allBarangays', 'All Barangays')}</option>
            {BARANGAYS.map(b => <option key={b}>{b}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

export function BeneficiariesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const urlLimit = parseInt(searchParams.get('limit') || '10', 10);
  const urlSearch = searchParams.get('search') || '';
  const urlCategory = searchParams.get('category') || '';
  const urlBarangay = searchParams.get('barangay') || 'all';

  const [searchInput, setSearchInput] = useState(urlSearch);
  const [categoryFilter, setCategoryFilter] = useState(urlCategory);
  const [barangayFilter, setBarangayFilter] = useState(urlBarangay);

  const updateURL = useCallback(
    (overrides: Record<string, string | undefined>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(overrides)) {
          if (v && v !== 'all') next.set(k, v);
          else next.delete(k);
        }
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  // Sync local state when URL changes externally (browser back/forward)
  useEffect(() => {
    setSearchInput(urlSearch);
    setCategoryFilter(urlCategory);
    setBarangayFilter(urlBarangay);
  }, [urlSearch, urlCategory, urlBarangay]);

  function handleSearch() {
    if (searchInput !== urlSearch) {
      updateURL({ search: searchInput || undefined, page: '1' });
    }
  }

  const pagination: PaginationState = { pageIndex: urlPage - 1, pageSize: urlLimit };

  const onPaginationChange = useCallback(
    (updater: Updater<PaginationState>) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater;
      updateURL({ page: String(next.pageIndex + 1), limit: String(next.pageSize) });
    },
    [pagination, updateURL],
  );

  const params = {
    search: urlSearch || undefined,
    category: categoryFilter || undefined,
    barangay: barangayFilter === 'all' ? undefined : barangayFilter,
    page: urlPage,
    limit: urlLimit,
  };
  const swrKey = queryKeys.beneficiaries.list(params);
  const { data, isLoading, isValidating, error, mutate } = useSWR<{ data: Record<string, unknown>[]; total: number }>(swrKey, {
    keepPreviousData: true,
  });

  const beneficiaries = useMemo(() => (data?.data || []).map(mapBeneficiary), [data]);
  const beneficiaryColumns = useMemo(() => makeBeneficiaryColumns(t), [t]);
  const total = data?.total ?? 0;
  const lastSync = data ? Date.now() : null;

  const loading = isLoading;
  const fetching = isValidating;
  const canShowResults = !loading && !fetching && beneficiaries.length > 0;

  if (loading) {
    return (
      <PageShell title={t('beneficiaries.title', 'Beneficiaries')} description={t('beneficiaries.description', 'Manage beneficiary records and household data')}>
        <TableSkeleton rows={8} />
      </PageShell>
    );
  }

  if (error && !data) {
    return (
      <PageShell title={t('beneficiaries.title', 'Beneficiaries')} description={t('beneficiaries.description', 'Manage beneficiary records and household data')}>
        <ErrorState title={t('beneficiaries.loadFailed', 'Could not load beneficiaries')} message={t('beneficiaries.loadFailedMessage', 'Check your internet connection and try again.')} onRetry={() => mutate()} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={t('beneficiaries.title', 'Beneficiaries')}
      description={t('beneficiaries.description', 'Manage beneficiary records and household data')}
      cachedAt={lastSync ?? undefined}
    >
      <FilterBar
        searchInput={searchInput}
        onSearchChange={(v) => setSearchInput(v)}
        onSearch={handleSearch}
        categoryFilter={categoryFilter}
        onCategoryChange={(v) => { setCategoryFilter(v); updateURL({ category: v || undefined, page: '1' }); }}
        barangayFilter={barangayFilter}
        onBarangayChange={(v) => { setBarangayFilter(v); updateURL({ barangay: v === 'all' ? undefined : v, page: '1' }); }}
      />

      {canShowResults && (
        <div className="text-sm text-muted-foreground flex items-center gap-1">
          {fetching && <Loader2 size={14} className="animate-spin" />}
          {!fetching && t('beneficiaries.showingResults', 'Showing {{count}} results', { count: beneficiaries.length })}
          {!fetching && urlSearch && t('beneficiaries.forSearch', ' for "{{search}}"', { search: urlSearch })}
        </div>
      )}

      <DataTable
        columns={beneficiaryColumns}
        data={beneficiaries}
        rowCount={total}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        sorting={[]}
      />
    </PageShell>
  );
}
