import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import { queryKeys } from '@/lib/query-keys';

interface TrendData {
  month: string;
  casesCreated: number;
  transitioning: number;
}

export type TrendRange = '1w' | '1m' | '3m' | '6m';

const RANGES: { value: TrendRange; labelKey: string; label: string }[] = [
  { value: '1w', labelKey: 'dashboard.range1w', label: '1 Week' },
  { value: '1m', labelKey: 'dashboard.range1m', label: '1 Month' },
  { value: '3m', labelKey: 'dashboard.range3m', label: '3 Months' },
  { value: '6m', labelKey: 'dashboard.range6m', label: '6 Months' },
];

export function TrendsChart() {
  const { t } = useTranslation();
  const [range, setRange] = useState<TrendRange>('6m');
  const { data } = useSWR<TrendData[]>(queryKeys.dashboard.trends(range));

  const series = data || [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-semibold">{t('dashboard.trends', 'Trends')}</CardTitle>
          <div className="flex items-center rounded-md border border-border p-0.5 bg-muted/30" role="group" aria-label={t('dashboard.trendRange', 'Trend range')}>
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRange(r.value)}
                aria-pressed={range === r.value}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                  range === r.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(r.labelKey, r.label)}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {series.length === 0 ? (
          <p className="text-xs text-muted-foreground py-8 text-center">{t('dashboard.noTrendData', 'No trend data')}</p>
        ) : (
          <>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">{t('dashboard.cases', 'Cases')}</p>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={series}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="casesCreated" name={t('dashboard.cases', 'Cases')} fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">{t('dashboard.disbursed', 'Disbursed (₱)')}</p>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={series}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="transitioning" name={t('dashboard.disbursed', 'Disbursed (₱)')} fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}