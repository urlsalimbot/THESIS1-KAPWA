import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { Search, TrendingUp, Clock, ClipboardList, ArrowRight, Send } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useTranslation } from 'react-i18next';
import { statusLabel } from '@/i18n/display';

export function CoordinatorWidgets() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading: loading } = useSWR<{
    pendingReview?: number;
    servedToday?: number;
    recentCases?: any[];
  }>(queryKeys.dashboard.stats());

  const { data: refCounts } = useSWR<{ total: number; pending: number }>(
    'referral-counts',
    () => api.get('/referrals/counts'),
    { revalidateOnFocus: false },
  );

  const caseCount = data?.pendingReview || 0;
  const servedToday = data?.servedToday || 0;
  const pendingReview = data?.pendingReview || 0;
  const referralTotal = refCounts?.total ?? 0;
  const referralPending = refCounts?.pending ?? 0;
  const recentEntries = data?.recentCases || [];

  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchId.trim()) return;
    setSearching(true);
    setSearchError('');
    setSearchResult(null);
    try {
      const result = await api.get(`/cases/${searchId.trim()}`);
      setSearchResult(result);
    } catch {
      setSearchError(t('dashboard.caseNotFound', 'Case not found'));
    }
    setSearching(false);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i}><CardContent className="p-4"><div className="h-12 bg-muted animate-pulse rounded" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('dashboard.barangayCases', 'Barangay Cases')}</span>
              <TrendingUp className="ml-auto text-blue-600" size={16} />
            </div>
            <div className="text-2xl font-bold text-foreground font-heading">{caseCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('dashboard.servedToday', 'Served Today')}</span>
              <Clock className="ml-auto text-yellow-600" size={16} />
            </div>
            <div className="text-2xl font-bold text-foreground font-heading">{servedToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('dashboard.pendingReview', 'Pending Review')}</span>
              <ClipboardList className="ml-auto text-green-600" size={16} />
            </div>
            <div className="text-2xl font-bold text-foreground font-heading">{pendingReview}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/coordinator/referrals')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('dashboard.myReferrals', 'My Referrals')}</span>
              <Send className="ml-auto text-purple-600" size={16} />
            </div>
            <div className="text-2xl font-bold text-foreground font-heading">{referralTotal}</div>
            <div className="text-xs mt-1 text-muted-foreground">{t('dashboard.pending', '{{count}} pending', { count: referralPending })}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-primary">{t('dashboard.quickActions', 'Quick Actions')}</h3>
        </div>
        <CardContent className="p-4 flex gap-2">
          <Button size="sm" onClick={() => navigate('/coordinator/referrals/new')}>
            <Send size={14} className="mr-1" /> {t('dashboard.newReferral', 'New Referral')}
          </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/referrals')}>
            {t('dashboard.viewReferrals', 'View Referrals')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold text-sm text-primary">{t('dashboard.quickCaseSearch', 'Quick Case Search')}</h3>
        </div>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                type="text"
                value={searchId}
                onChange={e => setSearchId(e.target.value)}
                placeholder={t('dashboard.enterCaseId', 'Enter Case ID...')}
                className="w-full pl-8 pr-3 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <Button type="submit" disabled={searching} size="sm">
              {searching ? t('dashboard.searching', 'Searching...') : t('dashboard.search', 'Search')}
            </Button>
          </form>
          {searchError && <p className="text-destructive text-sm mt-2">{searchError}</p>}
          {searchResult && (
            <div className="mt-3 p-3 border rounded bg-muted/50">
              <p className="text-sm"><strong>{t('dashboard.case', 'Case:')}</strong> {searchResult.id}</p>
              <p className="text-sm"><strong>{t('dashboard.status', 'Status:')}</strong> {statusLabel(t, searchResult.status)}</p>
              <button
                onClick={() => navigate(`/cases/${searchResult.id}`)}
                className="text-primary text-xs mt-1 flex items-center gap-1 hover:underline"
              >
                {t('dashboard.viewDetails', 'View details')} <ArrowRight size={14} />
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold text-sm text-primary">{t('dashboard.recentEntries', 'Recent Entries')}</h3>
        </div>
        {recentEntries.length === 0 ? (
          <CardContent><p className="text-sm text-muted-foreground py-4 text-center">{t('dashboard.noRecentEntries', 'No recent entries')}</p></CardContent>
        ) : (
          <div className="divide-y">
            {recentEntries.slice(0, 5).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{c.name || c.id}</p>
                  <p className="text-xs text-muted-foreground">{c.category} &middot; {c.barangay}</p>
                </div>
                <span className="text-xs text-muted-foreground">{statusLabel(t, c.status)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
