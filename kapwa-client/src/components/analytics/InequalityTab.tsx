import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { queryKeys } from '../../lib/query-keys';
import { MethodologyNote } from './MethodologyNote';

interface InequalityResponse {
  gini: number;
  top10Share: number;
  count: number;
  excludedMissing: number;
  lorenz: Array<{ p: number; share: number }>;
  deciles: number[];
}

export function InequalityTab({ filters }: { filters: Record<string, unknown> }) {
  const { t } = useTranslation();
  const { data, error, isLoading } = useSWR<InequalityResponse>(queryKeys.analytics.inequality(filters));

  if (error) {
    const body = (error as { body?: { code?: string; required?: number; actual?: number } }).body;
    if (body?.code === 'insufficient_data') {
      return <p className="text-sm text-muted-foreground">{t('analytics.insufficientData', 'Not enough data (needs {{required}}, found {{actual}})', { required: body.required, actual: body.actual })}</p>;
    }
    return <p className="text-sm text-muted-foreground">{t('analytics.noData', 'No data for the selected filters')}</p>;
  }
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">{t('analytics.loading', 'Loading…')}</p>;

  return (
    <div className="space-y-4">
      <MethodologyNote textKey="analytics.methodology.inequality" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{t('analytics.inequality.gini', 'Gini coefficient')}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{data.gini.toFixed(3)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{t('analytics.inequality.top10', 'Top 10% income share')}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{(data.top10Share * 100).toFixed(1)}%</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{t('analytics.inequality.count', 'Households with income')}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.count.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{t('analytics.inequality.excluded', 'Excluded (missing income): {{count}}', { count: data.excludedMissing })}</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.inequality.lorenz', 'Lorenz curve')}</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.lorenz}>
              <XAxis dataKey="p" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line type="monotone" dataKey="share" name={t('analytics.inequality.lorenz', 'Lorenz curve')} stroke="#3b82f6" dot={false} />
              <Line type="monotone" dataKey="p" name="—" stroke="#9ca3af" strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.inequality.deciles', 'Income deciles')}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-2 text-sm sm:grid-cols-5">
          {data.deciles.map((value, i) => (
            <div key={i}>
              <span className="text-xs text-muted-foreground">{t('analytics.inequality.decileLabel', 'D{{n}}', { n: i + 1 })}</span>
              <p className="font-medium">₱{value.toLocaleString()}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
