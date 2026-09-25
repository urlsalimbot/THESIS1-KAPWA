import { useTranslation } from 'react-i18next';
import { BARANGAYS } from '@/lib/constants';
import { Button } from '@/components/ui/button';

export interface AnalyticsFilterValue {
  range: '30d' | '90d' | '6m' | '1y' | 'all';
  barangay: string;
}

export function rangeToDates(range: AnalyticsFilterValue['range']): { from?: string; to?: string } {
  if (range === 'all') return {};
  const now = new Date();
  const from = new Date(now);
  if (range === '30d') from.setDate(from.getDate() - 30);
  if (range === '90d') from.setDate(from.getDate() - 90);
  if (range === '6m') from.setMonth(from.getMonth() - 6);
  if (range === '1y') from.setFullYear(from.getFullYear() - 1);
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

export function AnalyticsFilters({
  value,
  onChange,
}: {
  value: AnalyticsFilterValue;
  onChange: (next: AnalyticsFilterValue) => void;
}) {
  const { t } = useTranslation();
  const ranges: Array<{ key: AnalyticsFilterValue['range']; label: string }> = [
    { key: '30d', label: t('analytics.filters.range30d', 'Last 30 days') },
    { key: '90d', label: t('analytics.filters.range90d', 'Last 90 days') },
    { key: '6m', label: t('analytics.filters.range6m', 'Last 6 months') },
    { key: '1y', label: t('analytics.filters.range1y', 'Last year') },
    { key: 'all', label: t('analytics.filters.rangeAll', 'All time') },
  ];

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="analytics-range">
          {t('analytics.filters.range', 'Date range')}
        </label>
        <select
          id="analytics-range"
          className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={value.range}
          onChange={e => onChange({ ...value, range: e.target.value as AnalyticsFilterValue['range'] })}
        >
          {ranges.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="analytics-barangay">
          {t('analytics.filters.barangay', 'Barangay')}
        </label>
        <select
          id="analytics-barangay"
          className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={value.barangay}
          onChange={e => onChange({ ...value, barangay: e.target.value })}
        >
          <option value="">{t('analytics.filters.allBarangays', 'All barangays')}</option>
          {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      <Button size="sm" variant="outline" onClick={() => onChange({ ...value })}>
        {t('analytics.filters.apply', 'Apply')}
      </Button>
    </div>
  );
}
