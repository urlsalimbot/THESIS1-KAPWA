import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useSWR, { mutate } from 'swr';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { formatDateTime } from '../lib/format';
import { statusLabel, categoryLabel } from '@/i18n/display';
import { Search, Download, AlertTriangle, Eye } from 'lucide-react';
import { useCaseActions } from '../hooks/useCaseActions';
import { PageShell } from '@/components/PageShell';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '../lib/auth-context';
import type { ColumnDef, PaginationState, Updater } from '@tanstack/react-table';

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
  enrolled: 'outline',
  assessed: 'secondary',
  in_review: 'secondary',
  active: 'default',
  transitioning: 'secondary',
  closed: 'outline',
};

const STATUS_LABELS: Record<string, string> = {
  enrolled: 'Enrolled',
  assessed: 'Assessed',
  in_review: 'In Review',
  active: 'Active',
  transitioning: 'Transitioning',
  closed: 'Closed',
};
const STATUS_KEYS = Object.keys(STATUS_LABELS);

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
    barangay: ((ben.currentAddress as Record<string, string> | undefined)?.barangay || '').trim() || ((ben.address as string) || '').split(',').pop()?.trim() || '',
    remarks: (c.remarks as string) || '',
    date: c.updatedAt ? formatDateTime(c.updatedAt as string) : '',
    createdAt: (c.createdAt as string) || '',
    status: (c.status as string) || 'enrolled',
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
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const role = user?.role || '';
  const buttons: { action: string; label: string }[] = [];

  if (c.status === 'enrolled' && role === 'social_worker') {
    buttons.push({ action: 'request-review', label: t('cases.requestReview', 'Request Review') });
  }
  if (c.status === 'active' && role === 'admin') {
    buttons.push({ action: 'transition', label: t('cases.transition', 'Transition') });
  }
  if (c.status === 'transitioning' && (role === 'admin' || role === 'social_worker')) {
    buttons.push({ action: 'close', label: t('cases.close', 'Close') });
  }

  return (
    <div className="flex gap-1">
      <Button variant="secondary" size="sm" onClick={() => navigate(`/cases/${c.id}`)}>
        <Eye size={14} className="mr-1" /> {t('cases.view', 'View')}
      </Button>
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

// function exportCSV(rows: CaseRow[]) {
//   const headers = ['Date','Surname','First','Middle','Gender','Category','Barangay','Remarks'];
//   const data = rows.map(c => [c.date, c.surname, c.first, c.middle, c.gender, c.category, c.barangay, c.remarks]);
//   const csv = [headers, ...data].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
//   const blob = new Blob([csv], { type: 'text/csv' });
//   const url = URL.createObjectURL(blob);
//   const a = window.document.createElement('a');
//   a.href = url; a.download = 'cases-export.csv'; a.click();
//   URL.revokeObjectURL(url);
// }

export function CasesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { actionLoading, handleAction } = useCaseActions();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const urlLimit = parseInt(searchParams.get('limit') || '10', 10);
  const urlSearch = searchParams.get('search') || '';
  const urlBarangay = searchParams.get('barangay') || '';
  const urlCategory = searchParams.get('category') || '';
  const urlStatus = searchParams.get('status') || '';
  const urlGender = searchParams.get('gender') || '';
  const urlAgeRange = searchParams.get('ageRange') || '';
  const urlSla = searchParams.get('sla') || '';
  const urlDateFrom = searchParams.get('dateFrom') || '';
  const urlDateTo = searchParams.get('dateTo') || '';

  const [searchInput, setSearchInput] = useState(urlSearch);

  const updateURL = useCallback(
    (overrides: Record<string, string | undefined>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(overrides)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch, urlBarangay, urlCategory, urlStatus, urlGender, urlAgeRange, urlSla, urlDateFrom, urlDateTo]);

  function handleSearch() {
    if (searchInput !== urlSearch) {
      updateURL({ search: searchInput || undefined, page: '1' });
    }
  }

  const listParams = useMemo(() => {
    const p: Record<string, string> = {
      page: String(urlPage),
      limit: String(urlLimit),
    };
    if (urlSearch) p.search = urlSearch;
    if (urlStatus) p.status = urlStatus;
    if (urlBarangay) p.barangay = urlBarangay;
    if (urlCategory) p.category = urlCategory;
    if (urlGender) p.gender = urlGender;
    if (urlAgeRange) p.ageRange = urlAgeRange;
    if (urlSla) p.sla = urlSla;
    if (urlDateFrom) p.dateFrom = urlDateFrom;
    if (urlDateTo) p.dateTo = urlDateTo;
    return p;
  }, [urlPage, urlLimit, urlSearch, urlBarangay, urlCategory, urlStatus, urlGender, urlAgeRange, urlSla, urlDateFrom, urlDateTo]);

  const { data: caseResponse, isLoading, error, mutate } = useSWR<{ data: Record<string, unknown>[]; total: number }>(
    queryKeys.cases.list(listParams),
    { keepPreviousData: true },
  );
  const allCases = useMemo(() => (caseResponse?.data || []).map(mapCaseRow), [caseResponse]);
  const caseTotal = caseResponse?.total ?? 0;
  const lastSync = caseResponse ? Date.now() : null;

  const uniqueBarangays = useMemo(() => [...new Set(allCases.map(c => c.barangay).filter(Boolean))], [allCases]);
  const uniqueCategories = useMemo(() => [...new Set(allCases.map(c => c.category).filter(Boolean))], [allCases]);
  const uniqueGenders = useMemo(() => [...new Set(allCases.map(c => c.gender).filter(Boolean))], [allCases]);
  const uniqueAgeRanges = useMemo(() => [...new Set(allCases.map(c => c.ageRange).filter(Boolean))], [allCases]);

  const hasAnyFilter = Boolean(urlSearch || urlBarangay || urlCategory || urlStatus || urlGender || urlAgeRange || urlSla || urlDateFrom || urlDateTo);

  const clearFilters = useCallback(() => {
    setSearchInput('');
    updateURL({
      search: undefined, barangay: undefined, category: undefined,
      status: undefined, gender: undefined, ageRange: undefined,
      sla: undefined, dateFrom: undefined, dateTo: undefined, page: undefined,
    });
  }, [updateURL]);

  const columns = useMemo<ColumnDef<CaseRow>[]>(() => [
    { accessorKey: 'date', header: t('cases.date', 'Date'), cell: ({ row }) => <span className="text-xs text-muted-foreground tabular-nums">{row.original.date}</span> },
    { accessorKey: 'surname', header: t('cases.surname', 'Surname') },
    { accessorKey: 'first', header: t('cases.firstName', 'First') },
    { accessorKey: 'middle', header: t('cases.middleName', 'Middle') },
    { accessorKey: 'gender', header: t('cases.gender', 'Gender') },
    { accessorKey: 'category', header: t('cases.category', 'Category'), cell: ({ row }) => <Badge variant="secondary">{row.original.category.split(', ').map(c => categoryLabel(t, c)).join(', ')}</Badge> },
    { accessorKey: 'barangay', header: t('cases.barangay', 'Barangay') },
    { accessorKey: 'remarks', header: t('cases.remarks', 'Remarks'), cell: ({ row }) => <span className="text-xs text-muted-foreground/70">{row.original.remarks || '—'}</span> },
    { id: 'actions', header: t('cases.actions', 'Actions'), cell: ({ row }) => <ActionsCell c={row.original} actionLoading={actionLoading} onAction={handleAction} /> },
  ], [actionLoading, handleAction, t]);

  const pagination: PaginationState = { pageIndex: urlPage - 1, pageSize: urlLimit };

  const onPaginationChange = useCallback(
    (updater: Updater<PaginationState>) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater;
      updateURL({ page: String(next.pageIndex + 1), limit: String(next.pageSize) });
    },
    [pagination, updateURL],
  );

  if (isLoading) {
    return (
      <PageShell title={t('cases.title', 'Case Tracker')} description={t('cases.description', 'Real-time view of processed interventions and logs.')}>
        <TableSkeleton rows={8} />
      </PageShell>
    );
  }

  if (error && !caseResponse) {
    return (
      <PageShell title={t('cases.title', 'Case Tracker')} description={t('cases.description', 'Real-time view of processed interventions and logs.')}>
        <ErrorState title={t('cases.loadFailed', 'Could not load cases')} message={t('cases.loadFailedMessage', 'Check your internet connection and try again.')} onRetry={() => mutate()} />
      </PageShell>
    );
  }

  return (
    <PageShell title={t('cases.title', 'Case Tracker')} description={t('cases.description', 'Real-time view of processed interventions and logs.')} cachedAt={lastSync ?? undefined}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <FilterSelect label={t('cases.barangay', 'Barangay')} value={urlBarangay} onChange={(v) => updateURL({ barangay: v || undefined, page: '1' })}
            options={[{ value: '', label: t('cases.allBarangays', 'All Barangays') }, ...uniqueBarangays.map(b => ({ value: b, label: b }))]} className="w-40" />
          <FilterSelect label={t('cases.category', 'Category')} value={urlCategory} onChange={(v) => updateURL({ category: v || undefined, page: '1' })}
            options={[{ value: '', label: t('cases.allCategories', 'All Categories') }, ...uniqueCategories.map(c => ({ value: c, label: c }))]} className="w-44" />
          <FilterSelect label={t('cases.status', 'Status')} value={urlStatus} onChange={(v) => updateURL({ status: v || undefined, page: '1' })}
            options={[{ value: '', label: t('cases.allStatuses', 'All Statuses') }, ...STATUS_KEYS.map(k => ({ value: k, label: statusLabel(t, k) }))]} className="w-36" />
          <FilterSelect label={t('cases.gender', 'Gender')} value={urlGender} onChange={(v) => updateURL({ gender: v || undefined, page: '1' })}
            options={[{ value: '', label: t('cases.allGenders', 'All Genders') }, ...uniqueGenders.map(g => ({ value: g, label: g }))]} className="w-32" />
          <FilterSelect label={t('cases.ageRange', 'Age Range')} value={urlAgeRange} onChange={(v) => updateURL({ ageRange: v || undefined, page: '1' })}
            options={[{ value: '', label: t('cases.allAges', 'All Ages') }, ...uniqueAgeRanges.map(a => ({ value: a, label: a }))]} className="w-32" />
          <FilterSelect label="SLA" value={urlSla} onChange={(v) => updateURL({ sla: v || undefined, page: '1' })}
            options={[{ value: '', label: t('cases.allSla', 'All SLA') }, { value: 'overdue', label: t('cases.overdue', 'Overdue') }, { value: 'on_track', label: t('cases.onTrack', 'On Track') }]} className="w-32" />
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-muted-foreground font-medium">{t('cases.dateFrom', 'Date From')}</label>
            <Input type="date" aria-label={t('cases.dateFrom', 'Date From')} className="w-36" value={urlDateFrom} onChange={e => updateURL({ dateFrom: e.target.value || undefined, page: '1' })} />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-muted-foreground font-medium">{t('cases.dateTo', 'Date To')}</label>
            <Input type="date" aria-label={t('cases.dateTo', 'Date To')} className="w-36" value={urlDateTo} onChange={e => updateURL({ dateTo: e.target.value || undefined, page: '1' })} />
          </div>
          {hasAnyFilter && (
            <Button variant="ghost" size="sm" onClick={clearFilters} aria-label={t('cases.clearFilters', 'Clear filters')}>{t('cases.clear', 'Clear')}</Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input type="text" aria-label={t('cases.searchCases', 'Search cases')} placeholder={t('cases.searchPlaceholder', 'Search records...')} className="w-48 pl-8"
              value={searchInput} onChange={e => setSearchInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }} />
          </div>
          <Button size="sm" onClick={handleSearch}>{t('cases.search', 'Search')}</Button>
        </div>
      </div>

      <DataTable columns={columns} data={allCases} rowCount={caseTotal}
        pagination={pagination} onPaginationChange={onPaginationChange} sorting={[]} />
    </PageShell>
  );
}
