import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Clock, ClipboardList, MessageSquare, ArrowRight, Eye, Send, ExternalLink, Search, Loader2, BadgeCheck } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '../lib/api';
import type { ColumnDef } from '@tanstack/react-table';

export function CoordinatorDashboardPage() {
  const navigate = useNavigate();
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const [stats, setStats] = useState<any[]>([]);
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [data, refCounts] = await Promise.all([
        api.get<any>('/dashboard'),
        api.get<{ total: number; pending: number }>('/referrals/counts').catch(() => null),
      ]);
      const referralsText = refCounts ? `${refCounts.pending} pending of ${refCounts.total}` : '—';
      setStats([
        { label: 'Served Today', value: String(data.servedToday || 0), change: `${data.servedChange || '+0%'} from yesterday`, icon: TrendingUp },
        { label: 'Pending Cases', value: String(data.pendingReview || 0), change: `${data.urgentCount || 0} urgent`, icon: Clock },
        { label: 'My Referrals', value: String(refCounts?.total ?? '--'), change: referralsText, icon: Send },
        { label: 'Messages', value: String(data.unreadMessages || 0), change: 'Unread messages', icon: MessageSquare },
      ]);
      setRecentEntries(data.recentCases || []);
    } catch {
      setStats([
        { label: 'Served Today', value: '--', change: 'Offline', icon: TrendingUp },
        { label: 'Pending Cases', value: '--', change: 'N/A', icon: Clock },
        { label: 'My Referrals', value: '--', change: 'Offline', icon: Send },
        { label: 'Messages', value: '--', change: 'N/A', icon: MessageSquare },
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

  const entryColumns: ColumnDef<any>[] = [
    { accessorKey: 'date', header: 'Date', cell: ({ row }) => <span className="text-xs text-muted-foreground tabular-nums">{row.original.date}</span> },
    { id: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: 'category', header: 'Category' },
    { accessorKey: 'barangay', header: 'Barangay' },
    { accessorKey: 'remarks', header: 'Remarks', cell: ({ row }) => <span className="text-xs text-muted-foreground/70">{row.original.remarks}</span> },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <Button variant="secondary" size="sm" onClick={() => navigate(`/cases/${row.original.id}`)} aria-label="View Case">
          <Eye size={14} className="mr-1" /> View
        </Button>
      ),
    },
  ];

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading dashboard...</div>;

  return (
    <PageShell
      title="Coordinator Dashboard"
      description="Overview of barangay social welfare activities."
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate('/referrals')}>
            <ExternalLink size={14} className="mr-1" /> View Referrals
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/coordinator/access-cards')}>
            <BadgeCheck size={14} className="mr-1" /> Access Cards
          </Button>
          <Button size="sm" onClick={() => navigate('/coordinator/referrals/new')}>
            <Send size={14} className="mr-1" /> New Referral
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{s.label}</span>
                  <div className="ml-auto rounded-full w-8 h-8 flex items-center justify-center bg-muted shadow-sm">
                    <Icon size={16} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-foreground font-heading tracking-tight tabular-nums mb-0.5">{s.value}</div>
                <p className="text-xs text-muted-foreground">{s.change}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Quick Case Search</h3>
        </div>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                aria-label="Search cases"
                placeholder="Enter Case ID..."
                className="w-full pl-8"
                value={searchId}
                onChange={e => setSearchId(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={searching}>
              {searching ? <Loader2 size={14} className="animate-spin mr-1" /> : <Search size={14} className="mr-1" />}
              {searching ? 'Searching...' : 'Search'}
            </Button>
          </form>
          {searchError && <p className="text-destructive text-sm mt-2">{searchError}</p>}
          {searchResult && (
            <div className="mt-3 p-3 border rounded-lg bg-muted/50">
              <p className="text-sm"><strong>Case:</strong> {searchResult.controlNo || '—'}</p>
              <p className="text-sm"><strong>Status:</strong> {searchResult.status}</p>
              <Button variant="link" size="sm" className="h-auto p-0 mt-1 text-xs" onClick={() => navigate(`/cases/${searchResult.id}`)}>
                View details <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Today's Tracker Entries</h3>
        </div>
        <CardContent className="p-4">
          {recentEntries.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">No entries today</div>
          ) : (
            <DataTable
              columns={entryColumns}
              data={recentEntries}
              rowCount={recentEntries.length}
              pagination={{ pageIndex: 0, pageSize: 10 }}
              onPaginationChange={() => {}}
              sorting={[]}
            />
          )}
          <div className="flex items-center justify-between mt-3">
            <span className="text-sm text-muted-foreground">{recentEntries.length} entries today</span>
            <Button variant="ghost" size="sm" onClick={() => navigate('/tracker')}>View Full Tracker</Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
