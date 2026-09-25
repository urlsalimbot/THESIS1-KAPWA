import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { queryKeys } from '../../lib/query-keys';
import { MethodologyNote } from './MethodologyNote';

type Cell = { value: number } | { suppressed: true };
type HhiLabel = 'dispersed' | 'moderate' | 'concentrated';
interface ConcentrationResponse {
  hhiCases: number;
  hhiCasesLabel: HhiLabel;
  hhiAssistance: number;
  hhiAssistanceLabel: HhiLabel;
  totalCases: number;
  totalAmount: number;
  barangays: Array<{ barangay: string; cases: Cell; interventions: Cell; amount: Cell; caseShare: Cell; amountShare: Cell }>;
}

function cellText(cell: Cell | undefined): string {
  if (!cell || 'suppressed' in cell) return '—';
  return typeof cell.value === 'number' ? cell.value.toLocaleString() : String(cell.value);
}

function HhiCard({ title, value, label }: { title: string; value: number; label: HhiLabel }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value.toFixed(3)}</p>
        <p className="text-xs text-muted-foreground">{t(`analytics.hhi.${label}`, label)}</p>
      </CardContent>
    </Card>
  );
}

export function ConcentrationTab({ filters }: { filters: Record<string, unknown> }) {
  const { t } = useTranslation();
  const { data, error, isLoading } = useSWR<ConcentrationResponse>(queryKeys.analytics.concentration(filters));
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
      <MethodologyNote textKey="analytics.methodology.concentration" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <HhiCard title={t('analytics.concentration.hhiCases', 'Case concentration (HHI)')} value={data.hhiCases} label={data.hhiCasesLabel} />
        <HhiCard title={t('analytics.concentration.hhiAssistance', 'Assistance concentration (HHI)')} value={data.hhiAssistance} label={data.hhiAssistanceLabel} />
      </div>
      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.concentration.barangay', 'Barangay')}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1">{t('analytics.concentration.barangay', 'Barangay')}</th>
                <th>{t('analytics.concentration.cases', 'Cases')}</th>
                <th>{t('analytics.concentration.interventions', 'Interventions')}</th>
                <th>{t('analytics.concentration.amount', 'Assistance')}</th>
                <th>{t('analytics.concentration.caseShare', 'Case share')}</th>
                <th>{t('analytics.concentration.amountShare', 'Assistance share')}</th>
              </tr>
            </thead>
            <tbody>
              {data.barangays.map(row => (
                <tr key={row.barangay} className="border-t">
                  <td className="py-1">{row.barangay}</td>
                  <td>{cellText(row.cases)}</td>
                  <td>{cellText(row.interventions)}</td>
                  <td>{cellText(row.amount)}</td>
                  <td>{cellText(row.caseShare)}</td>
                  <td>{cellText(row.amountShare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
