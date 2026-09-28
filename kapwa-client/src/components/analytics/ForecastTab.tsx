import { useState } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComposedChart, Line, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { queryKeys } from '../../lib/query-keys';
import { MethodologyNote } from './MethodologyNote';

interface ForecastPoint { month: string; value: number; lower: number; upper: number }
interface ForecastResponse {
  metric: 'cases' | 'disbursement';
  months: number;
  history: Array<{ month: string; value: number }>;
  fitted: Array<{ month: string; value: number }>;
  forecast: ForecastPoint[];
  mape: number | null;
  baselineMape: number | null;
  alpha: number;
  beta: number;
}

export function ForecastTab({ filters }: { filters: Record<string, unknown> }) {
  const { t } = useTranslation();
  const [metric, setMetric] = useState<'cases' | 'disbursement'>('cases');
  const [horizon, setHorizon] = useState(6);
  const params = { ...filters, metric, horizon };
  const { data, error, isLoading } = useSWR<ForecastResponse>(queryKeys.analytics.forecast(params));

  if (error) return <p className="text-sm text-muted-foreground">{t('analytics.noData', 'No data for the selected filters')}</p>;
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">{t('analytics.loading', 'Loading…')}</p>;

  const chartData = [
    ...data.history.map((h, i) => ({ month: h.month, value: h.value, fitted: data.fitted[i]?.value })),
    ...data.forecast.map(f => ({ month: f.month, forecast: f.value, range: [f.lower, f.upper] as [number, number] })),
  ];
  const pct = (v: number | null) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);

  return (
    <div className="space-y-4">
      <MethodologyNote textKey="analytics.methodology.forecast" />
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="forecast-metric">{t('analytics.forecast.metric', 'Metric')}</label>
          <select id="forecast-metric" className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={metric} onChange={e => setMetric(e.target.value as 'cases' | 'disbursement')}>
            <option value="cases">{t('analytics.forecast.cases', 'Cases')}</option>
            <option value="disbursement">{t('analytics.forecast.disbursement', 'Disbursement')}</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="forecast-horizon">{t('analytics.forecast.horizon', 'Horizon (months)')}</label>
          <select id="forecast-horizon" className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={horizon} onChange={e => setHorizon(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{t('analytics.forecast.mape', 'Model MAPE')}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{pct(data.mape)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{t('analytics.forecast.baselineMape', 'MA(3) baseline MAPE')}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{pct(data.baselineMape)}</p>
            <p className="text-xs text-muted-foreground">{t('analytics.forecast.params', 'Fitted alpha {{alpha}}, beta {{beta}}', { alpha: data.alpha, beta: data.beta })}</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.forecast.history', 'History and forecast')}</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData}>
              <XAxis dataKey="month" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Area type="monotone" dataKey="range" name="95%" stroke="none" fill="#3b82f6" fillOpacity={0.15} />
              <Line type="monotone" dataKey="value" name={t('analytics.forecast.cases', 'Cases')} stroke="#111827" dot={false} />
              <Line type="monotone" dataKey="fitted" name="Fitted" stroke="#9ca3af" dot={false} />
              <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#3b82f6" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
