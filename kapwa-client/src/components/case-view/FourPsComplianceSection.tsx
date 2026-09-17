import { useState } from 'react';
import useSWR from 'swr';
import { CheckCircle, Circle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ComplianceEntry {
  id: string;
  complianceType?: 'school_attendance' | 'health_checkup' | 'fds';
  dueDate: string;
  monthLabel?: string;
  met: boolean;
}

interface ComplianceStatus {
  total: number;
  complied: number;
  rate: number;
  byType: Record<string, { total: number; complied: number; rate: number }>;
  entries: ComplianceEntry[];
}

export function isFourPsCase(caseData: {
  serviceRequested?: unknown;
  clientCategory?: unknown;
} | null | undefined): boolean {
  if (!caseData) return false;
  const requested = Array.isArray(caseData.serviceRequested) ? caseData.serviceRequested.join(' ') : '';
  const haystack = `${requested} ${caseData.clientCategory ?? ''}`;
  return /4ps|pantawid/i.test(haystack);
}

export function FourPsComplianceSection({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const { data, isLoading, mutate } = useSWR<ComplianceStatus>(
    caseId ? queryKeys.fourps.compliance(caseId) : null,
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function generate() {
    setError('');
    setGenerating(true);
    try {
      await api.post(`/fourps/${caseId}/generate-compliance`);
      await mutate();
    } catch {
      setError(t('fourps.actionFailed', 'Action failed. Please try again.'));
    } finally {
      setGenerating(false);
    }
  }

  async function markMet(id: string) {
    setPendingId(id);
    setError('');
    try {
      await api.patch(`/fourps/compliance/${id}/meet`);
      await mutate();
    } catch {
      setError(t('fourps.actionFailed', 'Action failed. Please try again.'));
    } finally {
      setPendingId(null);
    }
  }

  const entries = data?.entries ?? [];
  const complied = data?.complied ?? 0;
  const total = data?.total ?? 0;
  const rate = total > 0 ? Math.round((complied / total) * 100) : 0;

  const typeLabel = (type?: string) => t(`fourps.type.${type || 'other'}`, { defaultValue: t('fourps.type.other', 'Other') });

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">{t('fourps.sectionTitle', '4Ps Compliance')}</h3>
          <p className="text-xs text-muted-foreground">
            {t('fourps.summary', '{{complied}}/{{total}} complied · {{rate}}% rate', { complied, total, rate })}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={generate} disabled={generating}>
          <RefreshCw size={14} className={`mr-1 ${generating ? 'animate-spin' : ''}`} />
          {generating ? t('fourps.generating', 'Generating…') : t('fourps.generate', 'Generate 12-Month Items')}
        </Button>
      </div>

      <div className="w-full bg-secondary rounded-full h-2 mb-4">
        <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${rate}%` }} />
      </div>

      {error && <p role="alert" className="mb-2 text-xs text-destructive">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('fourps.loading', 'Loading…')}</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('fourps.empty', 'No compliance items. Generate for this household.')}</p>
      ) : (
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {entries.map(entry => (
            <div key={entry.id} className="flex items-center justify-between py-1.5 text-sm border-b last:border-0">
              <div className="min-w-0">
                <span className={entry.met ? 'line-through text-muted-foreground' : ''}>
                  {typeLabel(entry.complianceType)}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {t('fourps.due', 'Due: {{date}}', { date: entry.dueDate })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={entry.met ? 'default' : 'secondary'} className="text-xs">
                  {entry.monthLabel || typeLabel(entry.complianceType)}
                </Badge>
                {entry.met ? (
                  <CheckCircle size={16} className="text-green-600" />
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2"
                    aria-label={t('fourps.markMet', 'Mark as complied')}
                    disabled={pendingId === entry.id}
                    onClick={() => markMet(entry.id)}
                  >
                    <Circle size={14} className="text-amber-600" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
