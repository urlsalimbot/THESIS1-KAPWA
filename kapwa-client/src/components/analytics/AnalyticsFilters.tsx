import { useTranslation } from 'react-i18next';
import { BARANGAYS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export interface AnalyticsFilterValue {
  range: '30d' | '90d' | '6m' | '1y' | 'all';
  barangay: string;
}

function monthsAgo(base: Date, months: number): Date {
  const month = base.getMonth() - months;
  const targetYear = base.getFullYear() + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  return new Date(targetYear, targetMonth, Math.min(base.getDate(), lastDay));
}

function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function rangeToDates(range: AnalyticsFilterValue['range']): { from?: string; to?: string } {
  if (range === 'all') return {};
  const now = new Date();
  const from = range === '30d' ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
    : range === '90d' ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90)
    : range === '6m' ? monthsAgo(now, 6)
    : monthsAgo(now, 12);
  return { from: toLocalIso(from), to: toLocalIso(now) };
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
        <Select value={value.range} onValueChange={(v) => onChange({ ...value, range: v as AnalyticsFilterValue['range'] })}>
          <SelectTrigger id="analytics-range" className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ranges.map(r => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="analytics-barangay">
          {t('analytics.filters.barangay', 'Barangay')}
        </label>
        <Select value={value.barangay} onValueChange={(v) => onChange({ ...value, barangay: v })}>
          <SelectTrigger id="analytics-barangay" className="h-9 text-sm">
            <SelectValue placeholder={t('analytics.filters.allBarangays', 'All barangays')} />
          </SelectTrigger>
          <SelectContent>
            {BARANGAYS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button size="sm" variant="outline" onClick={() => onChange({ ...value })}>
        {t('analytics.filters.apply', 'Apply')}
      </Button>
    </div>
  );
}
