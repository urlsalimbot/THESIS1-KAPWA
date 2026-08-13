import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Clock, ClipboardList, MessageSquare, ArrowRight, Eye, Send, ExternalLink, Search, Loader2, BadgeCheck } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { DataTable } from '@/components/data-table';
import { QuickScanCard } from '@/components/QuickScanCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '../lib/api';
import type { ColumnDef } from '@tanstack/react-table';

export function CoordinatorDashboardPage() {
  const { t } = useTranslation();
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
      const referralsText = refCounts ? `${t('dashboard.pendingCount', '{{count}} pending', { count: refCounts.pending })} ${t('dashboard.ofTotal', 'of')} ${refCounts.total}` : '—';
      setStats([
        { label: t('dashboard.servedToday', 'Served Today'), value: String(data.servedToday || 0), change: `${data.servedChange || '+0%'} ${t('dashboard.fromYesterday', 'from yesterday')}`, icon: TrendingUp },
        { label: t('dashboard.pendingCases', 'Pending Cases'), value: String(data.pendingReview || 0), change: `${data.urgentCount || 0} ${t('dashboard.urgent', 'urgent')}`, icon: Clock },
        { label: t('dashboard.myReferrals', 'My Referrals'), value: String(refCounts?.total ?? '--'), change: referralsText, icon: Send },
        { label: t('dashboard.messages', 'Messages'), value: String(data.unreadMessages || 0), change: t('dashboard.unreadMessages', 'Unread messages'), icon: MessageSquare },
      ]);
      setRecentEntries(data.recentCases || []);
    } catch {
      setStats([
        { label: t('dashboard.servedToday', 'Served Today'), value: '--', change: t('dashboard.offline', 'Offline'), icon: TrendingUp },
        { label: t('dashboard.pendingCases', 'Pending Cases'), value: '--', change: 'N/A', icon: Clock },
        { label: t('dashboard.myReferrals', 'My Referrals'), value: '--', change: t('dashboard.offline', 'Offline'), icon: Send },
        { label: t('dashboard.messages', 'Messages'), value: '--', change: 'N/A', icon: MessageSquare },
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
      setSearchError(t('dashboard.caseNotFound', 'Case not found'));
    }
    setSearching(false);
  }

  const entryColumns: ColumnDef<any>[] = [
    { accessorKey: 'date', header: t('dashboard.date', 'Date'), cell: ({ row }) => <span className="text-xs text-muted-foreground tabular-nums">{row.original.date}</span> },
    { id: 'name', header: t('dashboard.name', 'Name'), cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: 'category', header: t('dashboard.category', 'Category') },
    { accessorKey: 'barangay', header: t('dashboard.barangay', 'Barangay') },
    { accessorKey: 'remarks', header: t('dashboard.remarks', 'Remarks'), cell: ({ row }) => <span className="text-xs text-muted-foreground/70">{row.original.remarks}</span> },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <Button variant="secondary" size="sm" onClick={() => navigate(`/cases/${row.original.id}`)} aria-label={t('dashboard.viewCase', 'View Case')}>
          <Eye size={14} className="mr-1" /> {t('dashboard.view', 'View')}
        </Button>
      ),
    },
  ];

  if (loading) return <div className="p-8 text-center text-muted-foreground">{t('dashboard.loading', 'Loading dashboard...')}</div>;

  return (
    <PageShell
      title={t('dashboard.coordinatorTitle', 'Coordinator Dashboard')}
      description={t('dashboard.coordinatorDescription', 'Overview of barangay social welfare activities.')}
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate('/referrals')}>
            <ExternalLink size={14} className="mr-1" /> {t('dashboard.viewReferrals', 'View Referrals')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/coordinator/access-cards')}>
            <BadgeCheck size={14} className="mr-1" /> {t('dashboard.accessCards', 'Access Cards')}
          </Button>
          <Button size="sm" onClick={() => navigate('/coordinator/referrals/new')}>
            <Send size={14} className="mr-1" /> {t('dashboard.newReferral', 'New Referral')}
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

      <div className="mt-4">
        <QuickScanCard />
      </div>

      <Card className="mt-4">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t('dashboard.quickCaseSearch', 'Quick Case Search')}</h2>
        </div>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                aria-label={t('dashboard.searchCases', 'Search cases')}
                placeholder={t('dashboard.enterCaseId', 'Enter Case ID...')}
                className="w-full pl-8"
                value={searchId}
                onChange={e => setSearchId(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={searching}>
              {searching ? <Loader2 size={14} className="animate-spin mr-1" /> : <Search size={14} className="mr-1" />}
              {searching ? t('dashboard.searching', 'Searching...') : t('dashboard.search', 'Search')}
            </Button>
          </form>
          {searchError && <p className="text-destructive text-sm mt-2">{searchError}</p>}
          {searchResult && (
            <div className="mt-3 p-3 border rounded-lg bg-muted/50">
              <p className="text-sm"><strong>{t('dashboard.caseLabel', 'Case:')}</strong> {searchResult.controlNo || '—'}</p>
              <p className="text-sm"><strong>{t('dashboard.statusLabel', 'Status:')}</strong> {searchResult.status}</p>
              <Button variant="link" size="sm" className="h-auto p-0 mt-1 text-xs" onClick={() => navigate(`/cases/${searchResult.id}`)}>
                {t('dashboard.viewDetails', 'View details')} <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t('dashboard.todayTrackerEntries', "Today's Tracker Entries")}</h2>
        </div>
        <CardContent className="p-4">
          {recentEntries.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">{t('dashboard.noEntriesToday', 'No entries today')}</div>
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
            <span className="text-sm text-muted-foreground">{t('dashboard.entriesToday', '{{count}} entries today', { count: recentEntries.length })}</span>
            <Button variant="ghost" size="sm" onClick={() => navigate('/tracker')}>{t('dashboard.viewFullTracker', 'View Full Tracker')}</Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
