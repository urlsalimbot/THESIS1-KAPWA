import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { queryKeys } from '../../lib/query-keys';
import { MethodologyNote } from './MethodologyNote';

type Cell = { value: number } | { suppressed: true };
interface EquityResponse {
  barangays: Array<{ barangay: string; householdsShare: Cell; servedShare: Cell; assistanceShare: Cell; coverageRatio: Cell; coverageQuartile: Cell; fourPsShare: Cell }>;
}

function cellText(cell: Cell | undefined): string {
  if (!cell || 'suppressed' in cell) return '—';
  return cell.value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function EquityTab({ filters }: { filters: Record<string, unknown> }) {
  const { t } = useTranslation();
  const { data, error, isLoading } = useSWR<EquityResponse>(queryKeys.analytics.equity(filters));
  if (error) {
    const body = (error as { body?: { code?: string; required?: number; actual?: number } }).body;
    if (body?.code === 'insufficient_data') {
      return <p className="text-sm text-muted-foreground">{t('analytics.insufficientData', 'Not enough data (needs {{required}}, found {{actual}})', { required: body.required, actual: body.actual })}</p>;
    }
    return <p className="text-sm text-muted-foreground">{t('analytics.noData', 'No data for the selected filters')}</p>;
  }
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">{t('analytics.loading', 'Loading…')}</p>;

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm">{t('analytics.tabs.equity', 'Equity')}</CardTitle>
        <p className="text-xs text-muted-foreground">{t('analytics.equity.note', "Ratios compare each barangay's served share with its share of all households")}</p>
        <div className="pt-1"><MethodologyNote textKey="analytics.methodology.equity" /></div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1">{t('analytics.concentration.barangay', 'Barangay')}</th>
              <th>{t('analytics.equity.householdsShare', 'Household share')}</th>
              <th>{t('analytics.equity.servedShare', 'Served share')}</th>
              <th>{t('analytics.equity.assistanceShare', 'Assistance share')}</th>
              <th>{t('analytics.equity.coverageRatio', 'Coverage ratio')}</th>
              <th>{t('analytics.equity.coverageQuartile', 'Coverage quartile')}</th>
              <th>{t('analytics.equity.fourPsShare', '4Ps household share')}</th>
            </tr>
          </thead>
          <tbody>
            {data.barangays.map(row => (
              <tr key={row.barangay} className="border-t">
                <td className="py-1">{row.barangay}</td>
                <td>{cellText(row.householdsShare)}</td>
                <td>{cellText(row.servedShare)}</td>
                <td>{cellText(row.assistanceShare)}</td>
                <td>{cellText(row.coverageRatio)}</td>
                <td>{cellText(row.coverageQuartile)}</td>
                <td>{cellText(row.fourPsShare)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
