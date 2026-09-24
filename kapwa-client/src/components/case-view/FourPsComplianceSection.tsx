import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Circle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ComplianceEntry {
  id: string;
  complianceType?: 'school_attendance' | 'health_checkup' | 'fds';
  dueDate: string;
  monthLabel?: string;
  met: boolean;
  householdMemberId?: string;
  memberName?: string;
  memberRelationship?: string;
}

interface ComplianceStatus {
  total: number;
  complied: number;
  rate: number;
  byType: Record<string, { total: number; complied: number; rate: number }>;
  entries: ComplianceEntry[];
}

// The three 4Ps conditionalities, in the order the program states them.
const CONDITION_ORDER = ['health_checkup', 'school_attendance', 'fds'] as const;

/** Two consecutive non-compliant periods is the program's delisting trigger. */
const DELISTING_THRESHOLD = 2;

export function isFourPsCase(caseData: {
  serviceRequested?: unknown;
  clientCategory?: unknown;
} | null | undefined): boolean {
  if (!caseData) return false;
  const requested = Array.isArray(caseData.serviceRequested) ? caseData.serviceRequested.join(' ') : '';
  const haystack = `${requested} ${caseData.clientCategory ?? ''}`;
  return /4ps|pantawid/i.test(haystack);
}

export function FourPsComplianceSection({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const { data, isLoading, mutate } = useSWR<ComplianceStatus>(
    caseId ? queryKeys.fourps.compliance(caseId) : null,
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkPeriod, setBulkPeriod] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const typeLabel = (type?: string) =>
    t(`fourps.type.${type || 'other'}`, { defaultValue: t('fourps.type.other', 'Other') });

  const entries = data?.entries ?? [];
  const complied = data?.complied ?? 0;
  const total = data?.total ?? 0;
  const rate = total > 0 ? Math.round((complied / total) * 100) : 0;

  // Group by compliance period (one month), oldest first.
  const periods = useMemo(() => {
    const byLabel = new Map<string, { label: string; dueDate: string; items: ComplianceEntry[] }>();
    for (const entry of entries) {
      const label = entry.monthLabel || entry.dueDate?.slice(0, 7) || '—';
      const bucket = byLabel.get(label) ?? { label, dueDate: entry.dueDate, items: [] };
      bucket.items.push(entry);
      if (entry.dueDate < bucket.dueDate) bucket.dueDate = entry.dueDate;
      byLabel.set(label, bucket);
    }
    return [...byLabel.values()]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map(p => ({
        ...p,
        complied: p.items.filter(i => i.met).length,
        total: p.items.length,
      }));
  }, [entries]);

  // Members with two or more consecutive unmet periods — the delisting rule.
  // Surfacing this is the point of monitoring compliance at all.
  const atRisk = useMemo(() => {
    const byMember = new Map<string, { name: string; relationship?: string; periods: ComplianceEntry[][] }>();
    for (const period of periods) {
      for (const item of period.items) {
        const key = item.householdMemberId || item.memberName || 'unknown';
        const bucket = byMember.get(key) ?? {
          name: item.memberName || t('fourps.noMember', 'Household member'),
          relationship: item.memberRelationship,
          periods: [],
        };
        const last = bucket.periods[bucket.periods.length - 1];
        // Items arrive grouped by period already, so a new period means a new bucket.
        if (last && last[0] && last[0].monthLabel === item.monthLabel) last.push(item);
        else bucket.periods.push([item]);
        byMember.set(key, bucket);
      }
    }
    const flagged: Array<{ name: string; relationship?: string; missedPeriods: number }> = [];
    for (const member of byMember.values()) {
      let run = 0;
      let worst = 0;
      for (const periodItems of member.periods) {
        const unmet = periodItems.some(i => !i.met);
        run = unmet ? run + 1 : 0;
        if (run > worst) worst = run;
      }
      if (worst >= DELISTING_THRESHOLD) {
        flagged.push({ name: member.name, relationship: member.relationship, missedPeriods: worst });
      }
    }
    return flagged.sort((a, b) => b.missedPeriods - a.missedPeriods);
  }, [periods, t]);

  async function generate() {
    setError('');
    setGenerating(true);
    try {
      await api.post(`/fourps/${caseId}/generate-compliance`);
      await mutate();
    } catch {
      setError(t('fourps.actionFailed', 'Action failed. Please try again.'));
    } finally {
      setGenerating(false);
    }
  }

  async function markMet(id: string) {
    setPendingId(id);
    setError('');
    try {
      await api.patch(`/fourps/compliance/${id}/meet`);
      await mutate();
    } catch {
      setError(t('fourps.actionFailed', 'Action failed. Please try again.'));
    } finally {
      setPendingId(null);
    }
  }

  // Verification happens per period, so offer it per period rather than making
  // the worker click every member's condition individually.
  async function markPeriodMet(periodLabel: string) {
    const period = periods.find(p => p.label === periodLabel);
    const unmet = period?.items.filter(i => !i.met) ?? [];
    if (unmet.length === 0) return;
    setBulkPeriod(periodLabel);
    setError('');
    try {
      for (const item of unmet) {
        await api.patch(`/fourps/compliance/${item.id}/meet`);
      }
      await mutate();
    } catch {
      setError(t('fourps.actionFailed', 'Action failed. Please try again.'));
      await mutate();
    } finally {
      setBulkPeriod(null);
    }
  }

  const conditionTiles = CONDITION_ORDER.filter(type => data?.byType?.[type]).map(type => {
    const stat = data!.byType[type];
    return {
      type,
      label: typeLabel(type),
      complied: stat.complied,
      total: stat.total,
      rate: Math.round(stat.rate * 100),
    };
  });

  return (
    <div className="space-y-4">
      {/* Header: overall rate + generate */}
      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">{t('fourps.sectionTitle', '4Ps Compliance')}</h3>
            <p className="text-xs text-muted-foreground">
              {t('fourps.summary', '{{complied}}/{{total}} complied · {{rate}}% rate', { complied, total, rate })}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={generate} disabled={generating}>
            <RefreshCw size={14} className={cn('mr-1', generating && 'animate-spin')} />
            {generating ? t('fourps.generating', 'Generating…') : t('fourps.generate', 'Generate 12-Month Items')}
          </Button>
        </div>

        <div className="px-4 pb-3">
          <div className="h-2 w-full rounded-full bg-secondary">
            <div
              className={cn('h-2 rounded-full transition-all', rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-destructive')}
              style={{ width: `${rate}%` }}
            />
          </div>
        </div>

        {/* Per-condition breakdown — the three conditionalities the program is built on */}
        {conditionTiles.length > 0 && (
          <div className="grid gap-2 border-t px-4 py-3 sm:grid-cols-3">
            {conditionTiles.map(tile => (
              <div key={tile.type} className="rounded-md border bg-muted/30 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">{tile.label}</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">
                  {tile.complied}/{tile.total}
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">{tile.rate}%</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {/* Delisting risk: two consecutive missed periods */}
      {atRisk.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-50 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangle size={16} aria-hidden="true" />
            {t('fourps.atRisk', 'Delisting risk')}
          </p>
          <p className="mt-1 text-xs text-amber-800/90">
            {t(
              'fourps.atRiskDesc',
              'Two consecutive non-compliant periods means delisting from the program. These members have missed two or more periods in a row:',
            )}
          </p>
          <ul className="mt-2 space-y-0.5">
            {atRisk.map(member => (
              <li key={member.name} className="text-xs text-amber-900">
                <span className="font-medium">{member.name}</span>
                {member.relationship ? <span className="text-amber-800/80"> · {member.relationship}</span> : null}
                <span className="ml-1">
                  {t('fourps.missedPeriods', '{{count}} consecutive periods missed', { count: member.missedPeriods })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('fourps.loading', 'Loading…')}</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('fourps.empty', 'No compliance items. Generate for this household.')}
        </p>
      ) : (
        <div className="space-y-2">
          {periods.map(period => {
            const isCollapsed = collapsed[period.label] ?? false;
            const complete = period.complied === period.total;
            return (
              <div key={period.label} className="rounded-lg border bg-card">
                <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => setCollapsed(prev => ({ ...prev, [period.label]: !isCollapsed }))}
                    aria-expanded={!isCollapsed}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    {isCollapsed
                      ? <ChevronRight size={14} className="text-muted-foreground" aria-hidden="true" />
                      : <ChevronDown size={14} className="text-muted-foreground" aria-hidden="true" />}
                    <span className="text-sm font-medium">{period.label}</span>
                    <Badge
                      variant={complete ? 'default' : 'secondary'}
                      className={cn('text-[10px]', complete && 'bg-emerald-500')}
                    >
                      {period.complied}/{period.total}
                    </Badge>
                  </button>
                  {!complete && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      disabled={bulkPeriod === period.label}
                      onClick={() => markPeriodMet(period.label)}
                    >
                      {bulkPeriod === period.label
                        ? t('fourps.saving', 'Saving…')
                        : t('fourps.markAll', 'Mark all complied')}
                    </Button>
                  )}
                </div>

                {!isCollapsed && (
                  <ul className="border-t">
                    {period.items.map(item => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 border-b px-4 py-2 last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm">
                            {item.memberName || t('fourps.noMember', 'Household member')}
                            {item.memberRelationship ? (
                              <span className="ml-1.5 text-xs text-muted-foreground">{item.memberRelationship}</span>
                            ) : null}
                          </p>
                          <p className="text-xs text-muted-foreground">{typeLabel(item.complianceType)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {item.met ? (
                            <>
                              <Badge variant="secondary" className="text-[10px]">
                                {t('fourps.complied', 'Complied')}
                              </Badge>
                              <CheckCircle size={16} className="text-emerald-500" aria-hidden="true" />
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1.5 px-2 text-xs"
                              aria-label={t('fourps.markMet', 'Mark as complied')}
                              disabled={pendingId === item.id || bulkPeriod === period.label}
                              onClick={() => markMet(item.id)}
                            >
                              <Circle size={14} className="text-amber-500" aria-hidden="true" />
                              {t('fourps.markMetShort', 'Mark complied')}
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
