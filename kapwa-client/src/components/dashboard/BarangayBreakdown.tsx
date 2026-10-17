import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';

interface BarangayItem {
  name: string;
  count: number;
}

interface BarangayBreakdownProps {
  cases: BarangayItem[];
}

export function BarangayBreakdown({ cases }: BarangayBreakdownProps) {
  const { t } = useTranslation();
  if (cases.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{t('dashboard.byBarangay', 'By Barangay')}</CardTitle></CardHeader>
        <CardContent><p className="text-xs text-muted-foreground py-4 text-center">{t('dashboard.noData', 'No data')}</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{t('dashboard.byBarangay', 'By Barangay')}</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={cases} layout="vertical">
            <XAxis type="number" tick={{ fontSize: '0.75rem' }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: '0.75rem' }} width={90} />
            <Tooltip contentStyle={{ fontSize: '0.75rem' }} />
            <Bar dataKey="count" fill="#3b82f6" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
