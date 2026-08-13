import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useTranslation } from 'react-i18next';
import { statusLabel } from '@/i18n/display';

const CHART_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#6b7280'];

interface CaseStatus {
  status: string;
  count: number;
}

interface CaseStatusChartProps {
  data: CaseStatus[];
}

export function CaseStatusChart({ data }: CaseStatusChartProps) {
  const { t } = useTranslation();
  const chartData = data.map(d => ({
    name: statusLabel(t, d.status),
    count: d.count,
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{t('dashboard.caseStatus', 'Case Status')}</CardTitle></CardHeader>
        <CardContent><p className="text-xs text-muted-foreground py-8 text-center">{t('dashboard.noCaseData', 'No case data')}</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{t('dashboard.caseStatus', 'Case Status')}</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: '12px' }} />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
