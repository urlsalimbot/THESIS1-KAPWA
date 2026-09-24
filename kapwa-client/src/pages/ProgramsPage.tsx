import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, FileText, Plus, ScrollText, Search } from 'lucide-react';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ApprovalStep {
  stepName: string;
  approverRole: string;
  slaDays: number;
  order: number;
}

interface ProgramRecord {
  id: string;
  name: string;
  category?: string;
  waitingPeriodDays?: number;
  legalBasis?: string;
  requiredDocuments?: string[];
  fundSources?: string[];
  approvalWorkflow?: ApprovalStep[];
  formTemplate?: Record<string, any>;
  formVersion: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type StatusFilter = 'all' | 'active' | 'inactive';

export function ProgramsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [records, setRecords] = useState<ProgramRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, []);

  async function load(signal?: AbortSignal) {
    setLoading(true);
    try {
      const data = await api.get<ProgramRecord[]>('/programs');
      setRecords(data || []);
    } catch { setRecords([]); }
    setLoading(false);
  }

  const filteredRecords = records.filter((r) => {
    const matchesSearch = !searchTerm
      || r.name?.toLowerCase().includes(searchTerm.toLowerCase())
      || r.category?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'active' ? r.isActive : !r.isActive);
    return matchesSearch && matchesStatus;
  });

  const activeCount = records.filter((r) => r.isActive).length;
  const inactiveCount = records.length - activeCount;

  const stats: { key: StatusFilter; label: string; value: number }[] = [
    { key: 'all', label: t('programs.statTotal', 'Total'), value: records.length },
    { key: 'active', label: t('programs.active', 'Active'), value: activeCount },
    { key: 'inactive', label: t('programs.inactive', 'Inactive'), value: inactiveCount },
  ];

  return (
    <PageShell
      title={t('programs.title', 'Programs')}
      description={t('programs.description', 'Configure intervention programs')}
      actions={
        <Button onClick={() => navigate('/admin/programs/new')} aria-label={t('programs.newProgram', 'New Program')} className="gap-1.5">
          <Plus size={16} aria-hidden="true" /> {t('programs.newProgram', 'New Program')}
        </Button>
      }
    >
      {msg && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-4">{msg}</div>
      )}

      {/* Summary + filters */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStatusFilter(s.key)}
            aria-pressed={statusFilter === s.key}
            className={cn(
              'rounded-xl border bg-card px-4 py-3 text-left transition-colors',
              statusFilter === s.key ? 'border-accent/50 ring-1 ring-accent/30' : 'border-border/60 hover:border-accent/30',
            )}
          >
            <p className="font-heading text-2xl font-bold tabular-nums tracking-tight text-accent">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden="true" />
          <Input
            type="text"
            placeholder={t('programs.searchPlaceholder', 'Search programs...')}
            className="h-9 pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label={t('programs.search', 'Search programs')}
          />
        </div>
        {(searchTerm || statusFilter !== 'all') && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}>
            {t('programs.clearFilters', 'Clear filters')}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-xl border border-border/60 bg-card" />
          ))}
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="rounded-xl border bg-card py-16 text-center text-muted-foreground">
          <FileText className="mx-auto mb-3 opacity-30" size={40} aria-hidden="true" />
          <p className="text-sm">
            {records.length === 0
              ? t('programs.empty', 'No programs configured yet. Create your first intervention program.')
              : t('programs.noMatches', 'No programs match your filters.')}
          </p>
          {records.length === 0 && (
            <Button className="mt-4 gap-1.5" onClick={() => navigate('/admin/programs/new')}>
              <Plus size={16} aria-hidden="true" /> {t('programs.newProgram', 'New Program')}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRecords.map((r) => (
            <Link
              key={r.id}
              to={`/admin/programs/${r.id}`}
              className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={t('programs.viewDetailsFor', 'View details for {{name}}', { name: r.name })}
            >
              <Card className="flex h-full flex-col border-border/60 transition-all duration-200 group-hover:-translate-y-1 group-hover:border-accent/30 group-hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 transition-colors group-hover:bg-accent/20">
                        <ScrollText size={20} className="text-accent" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <CardTitle className="truncate font-heading text-base tracking-tight">{r.name}</CardTitle>
                        {r.category && <p className="truncate text-xs text-muted-foreground">{r.category}</p>}
                      </div>
                    </div>
                    <Badge
                      variant={r.isActive ? 'default' : 'secondary'}
                      className={cn('shrink-0', r.isActive && 'bg-emerald-500')}
                    >
                      {r.isActive ? t('programs.active', 'Active') : t('programs.inactive', 'Inactive')}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-3">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {r.waitingPeriodDays != null && (
                      <span>{t('programs.wait', 'Wait: {{days}}d', { days: r.waitingPeriodDays })}</span>
                    )}
                    {r.fundSources?.length ? (
                      <span>{t('programs.fundsCount', '{{count}} fund source(s)', { count: r.fundSources.length })}</span>
                    ) : null}
                    {r.approvalWorkflow?.length ? (
                      <span>{t('programs.stepsCount', 'Steps: {{count}}', { count: r.approvalWorkflow.length })}</span>
                    ) : null}
                  </div>

                  {r.requiredDocuments && r.requiredDocuments.length > 0 && (
                    <div className="border-t pt-3">
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">{t('programs.requiredDocuments', 'Required Documents')}</p>
                      <ul className="flex flex-wrap gap-1.5">
                        {r.requiredDocuments.map((doc, i) => (
                          <li key={i}><Badge variant="outline" className="text-xs font-normal">{doc}</Badge></li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <span className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-medium text-accent">
                    {t('programs.viewDetails', 'View details')}
                    <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  );
}
