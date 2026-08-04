import React, { useState, useCallback } from 'react';
import useSWR from 'swr';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { queryKeys } from '../lib/query-keys';
import type { ColumnDef, PaginationState, Updater } from '@tanstack/react-table';

interface TrackerEntry {
  id: string;
  controlNo: string;
  dailySeqNum: number;
  transactionDate: string;
  surname: string;
  firstName: string;
  middleName: string;
  gender: string;
  ageRange: string;
  clientCategory: string;
  barangay: string;
  interventionRemarks: string;
}

interface TrackerStats {
  totalCasesLogged: number;
  todayEntries: number;
}

export function CaseTrackerPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const urlLimit = parseInt(searchParams.get('limit') || '10', 10);

  const updateURL = useCallback((overrides: Record<string, string | undefined>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(overrides)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const pagination: PaginationState = { pageIndex: urlPage - 1, pageSize: urlLimit };

  const onPaginationChange = useCallback(
    (updater: Updater<PaginationState>) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater;
      updateURL({ page: String(next.pageIndex + 1), limit: String(next.pageSize) });
    },
    [pagination, updateURL],
  );

  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  const hasRange = dateFrom !== dateTo;
  const swrKey = hasRange
    ? queryKeys.tracker.range({ start: dateFrom + 'T00:00:00Z', end: dateTo + 'T23:59:59Z' })
    : queryKeys.tracker.daily({ date: dateFrom + 'T00:00:00Z' });
  const { data: entries = [], isLoading: loading, error, mutate } = useSWR<TrackerEntry[]>(swrKey, {
    keepPreviousData: true,
  });
  const { data: stats } = useSWR<TrackerStats>(queryKeys.tracker.stats());
  const lastSync = entries ? Date.now() : null;

  const columns: ColumnDef<TrackerEntry>[] = [
    { accessorKey: 'dailySeqNum', header: '#', cell: ({ row }) => <span className="text-xs text-muted-foreground tabular-nums">{row.original.dailySeqNum}</span> },
    { accessorKey: 'transactionDate', header: 'Date', cell: ({ row }) => <span className="text-xs text-muted-foreground tabular-nums">{new Date(row.original.transactionDate).toLocaleDateString()}</span> },
    { accessorKey: 'controlNo', header: 'Control No.', cell: ({ row }) => <span className="font-mono text-xs">{row.original.controlNo}</span> },
    { accessorKey: 'surname', header: 'Surname' },
    { accessorKey: 'firstName', header: 'First Name' },
    { accessorKey: 'middleName', header: 'Middle Name' },
    { accessorKey: 'gender', header: 'Gender' },
    { accessorKey: 'ageRange', header: 'Age Range' },
    { accessorKey: 'clientCategory', header: 'Category' },
    { accessorKey: 'barangay', header: 'Barangay' },
    { accessorKey: 'interventionRemarks', header: 'Intervention', cell: ({ row }) => <span className="font-mono text-xs max-w-[200px] truncate block" title={row.original.interventionRemarks}>{row.original.interventionRemarks}</span> },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => navigate(`/cases/${row.original.id}`)} aria-label="View">
          <Eye size={14} className="mr-1" /> View
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <PageShell title="Daily Case Tracker" description="Case Tracker Log — derived from cases">
        <CardGridSkeleton count={2} />
      </PageShell>
    );
  }

  if (error && entries.length === 0) {
    return (
      <PageShell title="Daily Case Tracker" description="Case Tracker Log — derived from cases">
        <ErrorState title="Could not load case tracker" message="Check your internet connection and try again." onRetry={() => mutate()} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Daily Case Tracker"
      description="Case Tracker Log — derived from cases"
      cachedAt={lastSync ?? undefined}
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Cases</p>
            <p className="text-2xl font-bold text-primary">{stats?.totalCasesLogged ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Today's Cases</p>
            <p className="text-2xl font-bold text-primary">{stats?.todayEntries ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Date Range Selectors */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-foreground">From:</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} aria-label="Date from" className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
        <label className="text-sm font-medium text-foreground">To:</label>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} aria-label="Date to" className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
      </div>

      {/* Entries Table */}
      {!loading && entries.length === 0 ? (
        <EmptyState variant="no-data" />
      ) : (
        <DataTable
          columns={columns}
          data={entries}
          rowCount={entries.length}
          pagination={pagination}
          onPaginationChange={onPaginationChange}
          sorting={[]}
        />
      )}
    </PageShell>
  );
}
