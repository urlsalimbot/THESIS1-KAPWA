import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { queryKeys } from '@/lib/query-keys';

export type SuppressedCell = { value: number } | { suppressed: true };

interface DemographicsResponse {
  summary: { personsServed: SuppressedCell; householdsCovered: SuppressedCell; barangaysCovered: SuppressedCell };
  ageSex: Array<{ bracket: string; male: SuppressedCell; female: SuppressedCell }>;
  civilStatus: Array<{ label: string; count: SuppressedCell }>;
  occupation: Array<{ label: string; count: SuppressedCell }>;
  incomeBands: Array<{ label: string; count: SuppressedCell }>;
  householdSize: Array<{ label: string; count: SuppressedCell }>;
  dependencyRatio: number | null;
  philhealthCoverage: SuppressedCell;
}

function cellText(cell: SuppressedCell | undefined): string {
  if (!cell) return '—';
  return 'value' in cell ? String(cell.value) : '—';
}

function isSuppressed(cell: SuppressedCell | undefined): boolean {
  return !cell || 'suppressed' in cell;
}

export function DemographicsTab({ filters }: { filters: Record<string, unknown> }) {
  const { t } = useTranslation();
  const { data, error, isLoading } = useSWR<DemographicsResponse>(queryKeys.analytics.demographics(filters));

  if (error) {
    const body = (error as { body?: { code?: string; required?: number; actual?: number } }).body;
    if (body?.code === 'insufficient_data') {
      return <p className="text-sm text-muted-foreground">{t('analytics.insufficientData', 'Not enough data (needs {{required}}, found {{actual}})', { required: body.required, actual: body.actual })}</p>;
    }
    return <p className="text-sm text-destructive">{t('analytics.noData', 'No data for the selected filters')}</p>;
  }
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">{t('analytics.loading', 'Loading…')}</p>;

  const pyramid = data.ageSex.map(row => ({
    bracket: row.bracket,
    male: isSuppressed(row.male) ? 0 : (row.male as { value: number }).value,
    female: isSuppressed(row.female) ? 0 : (row.female as { value: number }).value,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: t('analytics.demographics.personsServed', 'Persons served'), cell: data.summary.personsServed },
          { label: t('analytics.demographics.households', 'Households'), cell: data.summary.householdsCovered },
          { label: t('analytics.demographics.barangays', 'Barangays'), cell: data.summary.barangaysCovered },
        ].map(card => (
          <Card key={card.label}>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{card.label}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{cellText(card.cell)}</p>
              {isSuppressed(card.cell) && <p className="text-xs text-muted-foreground">{t('analytics.suppressed', 'Suppressed (<5)')}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.demographics.ageSex', 'Age and sex')}</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={pyramid} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="bracket" tick={{ fontSize: 10 }} width={50} />
              <Tooltip contentStyle={{ fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="male" name={t('analytics.demographics.male', 'Male')} fill="#3b82f6" />
              <Bar dataKey="female" name={t('analytics.demographics.female', 'Female')} fill="#ec4899" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.demographics.civilStatus', 'Civil status')}</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {data.civilStatus.map(row => (
              <div key={row.label} className="flex justify-between text-sm">
                <span>{row.label}</span><span className="font-medium">{cellText(row.count)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.demographics.occupation', 'Occupation (top 10)')}</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {data.occupation.length === 0 && <p className="text-xs text-muted-foreground">{t('analytics.suppressed', 'Suppressed (<5)')}</p>}
            {data.occupation.map(row => (
              <div key={row.label} className="flex justify-between text-sm">
                <span>{row.label}</span><span className="font-medium">{cellText(row.count)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.demographics.income', 'Household income bands')}</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {data.incomeBands.map(row => (
              <div key={row.label} className="flex justify-between text-sm">
                <span>{row.label}</span><span className="font-medium">{cellText(row.count)}</span>
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">{t('analytics.demographics.incomeNote', 'Relative bands, not official poverty thresholds')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.demographics.dependency', 'Dependency ratio')}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold">{data.dependencyRatio != null ? data.dependencyRatio.toFixed(2) : '—'}</p>
            <p className="text-sm text-muted-foreground">{t('analytics.demographics.philhealth', 'PhilHealth coverage')}: {cellText(data.philhealthCoverage)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.demographics.householdSize', 'Household size')}</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {data.householdSize.map(row => (
              <div key={row.label} className="flex justify-between text-sm">
                <span>{row.label}</span><span className="font-medium">{cellText(row.count)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
