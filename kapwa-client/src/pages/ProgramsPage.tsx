import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, FileText, Plus, Search } from 'lucide-react';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

      {/* Summary + filters — a quiet segmented row, not stat cards */}
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {stats.map((s) => (
          <Button variant="ghost"
            key={s.key}
            type="button"
            onClick={() => setStatusFilter(s.key)}
            aria-pressed={statusFilter === s.key}
            className={cn(
              'transition-colors',
              statusFilter === s.key
                ? 'font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {s.label} <span className="tabular-nums text-muted-foreground">({s.value})</span>
          </Button>
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
        <div className="overflow-hidden rounded-lg border border-border/60 bg-card" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border/50 px-4 py-3.5 last:border-b-0">
              <div className="h-2 w-2 rounded-full bg-muted" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
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
        <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
          {filteredRecords.map((r) => (
            <Link
              key={r.id}
              to={`/admin/programs/${r.id}`}
              className="flex items-center justify-between gap-4 border-b border-border/50 px-4 py-3.5 transition-colors last:border-b-0 hover:bg-muted/40"
              aria-label={t('programs.viewDetailsFor', 'View details for {{name}}', { name: r.name })}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className={cn('h-2 w-2 shrink-0 rounded-full', r.isActive ? 'bg-success' : 'bg-muted-foreground/40')}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                  {r.category && <p className="truncate text-xs text-muted-foreground">{r.category}</p>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
                {r.fundSources?.length ? (
                  <span>{t('programs.fundsCount', '{{count}} fund source(s)', { count: r.fundSources.length })}</span>
                ) : null}
                {r.approvalWorkflow?.length ? (
                  <span>{t('programs.stepsCount', 'Steps: {{count}}', { count: r.approvalWorkflow.length })}</span>
                ) : null}
                {r.isActive
                  ? t('programs.active', 'Active')
                  : t('programs.inactive', 'Inactive')}
                <ChevronRight size={14} className="text-muted-foreground/60" aria-hidden="true" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  );
}
