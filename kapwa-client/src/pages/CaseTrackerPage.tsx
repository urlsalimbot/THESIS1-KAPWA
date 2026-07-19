import React, { useState } from 'react';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';

import { BARANGAYS, AGE_RANGES, CLIENT_CATEGORIES } from '../lib/constants';

interface TrackerEntry {
  id: string;
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
  const { mutate: globalMutate } = useSWRConfig();
  const navigate = useNavigate();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [form, setForm] = useState({
    surname: '', firstName: '', middleName: '', gender: 'M',
    ageRange: '' as string, clientCategory: '' as string,
    barangay: '', interventionRemarks: '',
  });
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const hasRange = dateFrom !== dateTo;
  const swrKey = hasRange
    ? queryKeys.tracker.range({ start: dateFrom + 'T00:00:00Z', end: dateTo + 'T23:59:59Z' })
    : queryKeys.tracker.daily({ date: dateFrom + 'T00:00:00Z' });
  const { data: entries = [], isLoading: loading } = useSWR<TrackerEntry[]>(swrKey, {
    keepPreviousData: true,
  });
  const { data: stats } = useSWR<TrackerStats>(queryKeys.tracker.stats());
  const lastSync = entries ? Date.now() : null;

  const addDate = dateFrom;

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        transactionDate: addDate,
        ...form,
      };
      await api.post('/tracker', payload);
      await globalMutate(swrKey);
      await globalMutate(queryKeys.tracker.stats());
      setForm({ surname: '', firstName: '', middleName: '', gender: 'M', ageRange: '', clientCategory: '', barangay: '', interventionRemarks: '' });
      setShowForm(false);
    } catch (e) { console.error("CaseTracker:", e); }
    finally { setSubmitting(false); }
  }

  const columns: ColumnDef<TrackerEntry>[] = [
    { accessorKey: 'dailySeqNum', header: '#', cell: ({ row }) => <span className="font-mono text-xs">{row.original.dailySeqNum}</span> },
    { accessorKey: 'surname', header: 'Surname' },
    { accessorKey: 'firstName', header: 'First Name' },
    { accessorKey: 'middleName', header: 'Middle Name' },
    { accessorKey: 'gender', header: 'Gender' },
    { accessorKey: 'ageRange', header: 'Age Range' },
    { accessorKey: 'clientCategory', header: 'Category' },
    { accessorKey: 'barangay', header: 'Barangay' },
    { accessorKey: 'interventionRemarks', header: 'Intervention', cell: ({ row }) => <span className="font-mono text-xs">{row.original.interventionRemarks}</span> },
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
      <PageShell title="Daily Case Tracker" description="Case Tracker Log — 'God Database' tally">
        <CardGridSkeleton count={2} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Daily Case Tracker"
      description="Case Tracker Log — 'God Database' tally"
      cachedAt={lastSync ?? undefined}
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Cases Logged</p>
            <p className="text-2xl font-bold text-primary">{stats?.totalCasesLogged ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Today's Entries</p>
            <p className="text-2xl font-bold text-primary">{stats?.todayEntries ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Date Range Selectors + Add Button */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-foreground">From:</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} aria-label="Date from" className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
        <label className="text-sm font-medium text-foreground">To:</label>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} aria-label="Date to" className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
        <button onClick={() => setShowForm(!showForm)} className="ml-auto inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2" aria-label="Add Entry">
          {showForm ? 'Cancel' : '+ Add Entry'}
        </button>
      </div>

      {/* Add Entry Form */}
      {showForm && (
        <form onSubmit={handleAddEntry} className="rounded-lg border border-border bg-card p-4">
          <h4 className="mb-3 font-semibold text-primary text-sm">New Tracker Entry</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground">Surname</label>
              <input className="w-full rounded border border-input bg-background px-2 py-1 text-sm" value={form.surname} onChange={e => setForm({...form, surname: e.target.value})} aria-label="Surname" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">First Name</label>
              <input className="w-full rounded border border-input bg-background px-2 py-1 text-sm" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} aria-label="First Name" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Middle Name</label>
              <input className="w-full rounded border border-input bg-background px-2 py-1 text-sm" value={form.middleName} onChange={e => setForm({...form, middleName: e.target.value})} aria-label="Middle Name" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Gender</label>
              <select className="w-full rounded border border-input bg-background px-2 py-1 text-sm" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} aria-label="Gender">
                <option value="M">M</option><option value="F">F</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Age Range</label>
              <select className="w-full rounded border border-input bg-background px-2 py-1 text-sm" value={form.ageRange} onChange={e => setForm({...form, ageRange: e.target.value})} aria-label="Age Range">
                <option value="">Select</option>
                {AGE_RANGES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Category</label>
              <select className="w-full rounded border border-input bg-background px-2 py-1 text-sm" value={form.clientCategory} onChange={e => setForm({...form, clientCategory: e.target.value})} aria-label="Client Category">
                <option value="">Select</option>
                {CLIENT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Barangay</label>
              <select className="w-full rounded border border-input bg-background px-2 py-1 text-sm" value={form.barangay} onChange={e => setForm({...form, barangay: e.target.value})} aria-label="Barangay">
                <option value="">Select</option>
                {BARANGAYS.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Intervention</label>
              <input className="w-full rounded border border-input bg-background px-2 py-1 text-sm" value={form.interventionRemarks} onChange={e => setForm({...form, interventionRemarks: e.target.value})} placeholder="FA/C/CSR..." aria-label="Intervention" />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="mt-3 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-md px-3 disabled:opacity-50" aria-label="Save Entry">
            {submitting ? 'Saving...' : 'Save Entry'}
          </button>
        </form>
      )}

      {/* Entries Table */}
      {!loading && entries.length === 0 ? (
        <EmptyState variant="no-data" />
      ) : (
        <DataTable
          columns={columns}
          data={entries}
          rowCount={entries.length}
          pagination={pagination}
          onPaginationChange={setPagination}
          sorting={[]}
        />
      )}
    </PageShell>
  );
}
