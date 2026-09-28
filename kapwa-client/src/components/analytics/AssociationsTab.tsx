import { useState, type ReactNode } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { queryKeys } from '../../lib/query-keys';
import { MethodologyNote } from './MethodologyNote';

type Cell = { value: number } | { suppressed: true };
interface Rule {
  a: string; b: string;
  countA: Cell; countB: Cell; countBoth: Cell;
  support: Cell; confidence: Cell; lift: Cell;
}
interface AssociationsResponse { totalTransactions: number; rules: Rule[] }

function cellText(cell: Cell | undefined, suppressedTitle: string): ReactNode {
  if (!cell || 'suppressed' in cell) return <span title={suppressedTitle}>—</span>;
  return cell.value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export function AssociationsTab({ filters }: { filters: Record<string, unknown> }) {
  const { t } = useTranslation();
  const [minSupport, setMinSupport] = useState(5);
  const [minConfidence, setMinConfidence] = useState(50);
  const params = { ...filters, minSupport: minSupport / 100, minConfidence: minConfidence / 100 };
  const { data, error, isLoading } = useSWR<AssociationsResponse>(queryKeys.analytics.associations(params));

  if (error) {
    const body = (error as { body?: { code?: string; required?: number; actual?: number } }).body;
    if (body?.code === 'insufficient_data') {
      return <p className="text-sm text-muted-foreground">{t('analytics.insufficientData', 'Not enough data (needs {{required}}, found {{actual}})', { required: body.required, actual: body.actual })}</p>;
    }
    return <p className="text-sm text-muted-foreground">{t('analytics.noData', 'No data for the selected filters')}</p>;
  }
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">{t('analytics.loading', 'Loading…')}</p>;

  const suppressedTitle = t('analytics.suppressed', 'Suppressed (<5)');

  return (
    <div className="space-y-4">
      <MethodologyNote textKey="analytics.methodology.associations" />
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="assoc-support">{t('analytics.associations.minSupport', 'Min support')} (%)</label>
          <input id="assoc-support" type="number" min={0} max={100} className="flex h-9 w-24 rounded-md border border-input bg-background px-2 text-sm" value={minSupport} onChange={e => setMinSupport(Math.max(0, Math.min(100, Number(e.target.value))))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="assoc-confidence">{t('analytics.associations.minConfidence', 'Min confidence')} (%)</label>
          <input id="assoc-confidence" type="number" min={0} max={100} className="flex h-9 w-24 rounded-md border border-input bg-background px-2 text-sm" value={minConfidence} onChange={e => setMinConfidence(Math.max(0, Math.min(100, Number(e.target.value))))} />
        </div>
        <p className="text-xs text-muted-foreground">{t('analytics.associations.total', '{{count}} cases analyzed', { count: data.totalTransactions })}</p>
      </div>
      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.tabs.associations', 'Associations')}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1">{t('analytics.associations.itemA', 'Service A')}</th>
                <th>{t('analytics.associations.itemB', 'Service B')}</th>
                <th>{t('analytics.associations.countBoth', 'Cases with both')}</th>
                <th>{t('analytics.associations.support', 'Support')}</th>
                <th>{t('analytics.associations.confidence', 'Confidence')}</th>
                <th>{t('analytics.associations.lift', 'Lift')}</th>
              </tr>
            </thead>
            <tbody>
              {data.rules.map(rule => (
                <tr key={`${rule.a}|${rule.b}`} className="border-t">
                  <td className="py-1">{rule.a}</td>
                  <td>{rule.b}</td>
                  <td>{cellText(rule.countBoth, suppressedTitle)}</td>
                  <td>{cellText(rule.support, suppressedTitle)}</td>
                  <td>{cellText(rule.confidence, suppressedTitle)}</td>
                  <td>{cellText(rule.lift, suppressedTitle)}</td>
                </tr>
              ))}
              {data.rules.length === 0 && (
                <tr><td colSpan={6} className="py-3 text-center text-xs text-muted-foreground">{t('analytics.noData', 'No data for the selected filters')}</td></tr>
              )}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">{t('analytics.associations.topNote', 'Shows the top 20 rules by lift')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
