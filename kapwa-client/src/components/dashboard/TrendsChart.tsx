import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';

interface TrendData {
  month: string;
  casesCreated: number;
  disbursed: number;
}

interface TrendsChartProps {
  data: TrendData[];
}

export function TrendsChart({ data }: TrendsChartProps) {
  const { t } = useTranslation();
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{t('dashboard.monthlyTrends', 'Monthly Trends (6mo)')}</CardTitle></CardHeader>
        <CardContent><p className="text-xs text-muted-foreground py-8 text-center">{t('dashboard.noTrendData', 'No trend data')}</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{t('dashboard.monthlyTrends', 'Monthly Trends (6mo)')}</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: '12px' }} />
            <Bar dataKey="casesCreated" name={t('dashboard.cases', 'Cases')} fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="transitioning" name={t('dashboard.transitioning', 'Transitioning (₱)')} fill="#10b981" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
