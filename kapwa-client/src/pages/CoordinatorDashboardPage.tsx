import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, RefreshCw, Search, ClipboardList, MessageSquare, Clock, ArrowRight, Eye } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { api } from '../lib/api';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';

export function CoordinatorDashboardPage() {
  const navigate = useNavigate();
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const [stats, setStats] = useState<any[]>([]);
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  const entryColumns: ColumnDef<any>[] = [
    { accessorKey: 'id', header: 'Case ID' },
    { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: 'category', header: 'Category' },
    { accessorKey: 'barangay', header: 'Barangay' },
    { accessorKey: 'remarks', header: 'Intervention/Remarks', cell: ({ row }) => <span className="text-xs">{row.original.remarks}</span> },
    { accessorKey: 'status', header: 'Status' },
    { accessorKey: 'date', header: 'Date', cell: ({ row }) => <span className="text-xs">{row.original.date}</span> },
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

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await api.get<any>('/dashboard');
      setStats([
        { label: 'Served Today', value: String(data.servedToday || 0), change: `${data.servedChange || '+0%'} from yesterday`, icon: TrendingUp, iconClass: 'bg-blue-50 text-blue-700' },
        { label: 'Pending Cases', value: String(data.pendingReview || 0), change: `${data.urgentCount || 0} urgent`, icon: Clock, iconClass: 'bg-yellow-100 text-yellow-800' },
        { label: 'Today Entries', value: String((data.recentCases || []).length), change: 'Tracker entries today', icon: ClipboardList, iconClass: 'bg-green-100 text-green-800' },
        { label: 'Messages', value: String(data.unreadMessages || 0), change: 'Unread messages', icon: MessageSquare, iconClass: 'bg-blue-50 text-cyan-600' },
      ]);
      setRecentEntries(data.recentCases || []);
    } catch {
      setStats([
        { label: 'Served Today', value: '--', change: 'Offline', icon: TrendingUp, iconClass: 'bg-blue-50 text-blue-700' },
        { label: 'Pending Cases', value: '--', change: 'N/A', icon: Clock, iconClass: 'bg-yellow-100 text-yellow-800' },
        { label: 'Today Entries', value: '--', change: 'Check connection', icon: ClipboardList, iconClass: 'bg-green-100 text-green-800' },
        { label: 'Messages', value: '--', change: 'N/A', icon: MessageSquare, iconClass: 'bg-blue-50 text-cyan-600' },
      ]);
    }
    setLoading(false);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchId.trim()) return;
    setSearching(true);
    setSearchError('');
    setSearchResult(null);
    try {
      const result = await api.get<any>(`/cases/${searchId.trim()}`);
      setSearchResult(result);
    } catch {
      setSearchError('Case not found');
    }
    setSearching(false);
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Loading dashboard...</div>;

  return (
    <PageShell
      title="Coordinator Dashboard"
      description="Overview of barangay social welfare activities."
    >

      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-gray-500 text-xs uppercase tracking-wide">{s.label}</span>
                <div className={`ml-auto rounded-full w-8 h-8 flex items-center justify-center ${s.iconClass}`}>
                  <Icon size={16} />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs mt-1">{s.change}</div>
            </div>
          );
        })}
      </div>

      <div className="mb-6">
        <h2 className="text-lg mb-3">Quick Case Search</h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={searchId}
              onChange={e => setSearchId(e.target.value)}
              placeholder="Enter Case ID..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="submit" disabled={searching} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>
        {searchError && <p className="text-red-600 text-sm mt-2">{searchError}</p>}
        {searchResult && (
          <div className="mt-3 p-3 border rounded-lg bg-gray-50">
            <p className="text-sm"><strong>Case:</strong> {searchResult.id}</p>
            <p className="text-sm"><strong>Status:</strong> {searchResult.status}</p>
            <button onClick={() => navigate(`/cases/${searchResult.id}`)} className="text-blue-600 text-xs mt-1 flex items-center gap-1">
              View details <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="mb-4">
        <h2 className="text-lg mb-3">Today's Tracker Entries</h2>
      </div>

      <div>
        {recentEntries.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">No entries today</div>
        ) : (
          <DataTable
            columns={entryColumns}
            data={recentEntries}
            rowCount={recentEntries.length}
            pagination={pagination}
            onPaginationChange={setPagination}
            sorting={[]}
          />
        )}
        <div className="flex items-center justify-between mt-3">
          <span className="text-sm text-muted-foreground">{recentEntries.length} entries today</span>
          <Button variant="ghost" size="sm" onClick={() => navigate('/tracker')}>View Full Tracker</Button>
        </div>
      </div>
    </PageShell>
  );
}
