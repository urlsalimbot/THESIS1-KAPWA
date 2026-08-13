import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function AuditPage() {
  const { t } = useTranslation();
  const today = new Date().toISOString().split('T')[0];
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const [startDate, setStartDate] = useState(yearStart);
  const [endDate, setEndDate] = useState(today);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handleExport() {
    setExporting(true);
    try {
      const data = await api.get<any>(`/audit/coa-export?startDate=${startDate}&endDate=${endDate}`);
      setResult(data);
    } catch { /* */ }
    setExporting(false);
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url; a.download = `coa-export-${startDate}-${endDate}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageShell title={t('audit.title', 'Audit & Compliance')} description={t('audit.description', 'FR-22 — COA-ready fund utilization reports')}>
      <div className="rounded-lg border bg-card shadow-sm p-4 mb-6">
        <h3 className="font-semibold mb-3">{t('audit.exportTitle', 'COA Fund Utilization Export')}</h3>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-muted-foreground font-medium">{t('audit.startDate', 'Start Date')}</label>
            <Input type="date" className="w-40" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-muted-foreground font-medium">{t('audit.endDate', 'End Date')}</label>
            <Input type="date" className="w-40" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <Button onClick={handleExport} disabled={exporting}>
            <Download size={14} className="mr-1" /> {exporting ? t('audit.exporting', 'Exporting...') : t('audit.export', 'Export')}
          </Button>
        </div>

        {result && (
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center gap-4">
              <span>{t('audit.totalInterventions', 'Total Interventions:')} <strong>{result.totalInterventions}</strong></span>
              <span>{t('audit.totalAmount', 'Total Amount:')} <strong>₱{Number(result.totalAmount).toLocaleString()}</strong></span>
              <Button variant="outline" size="sm" onClick={downloadJson}>
                <FileText size={14} className="mr-1" /> {t('audit.downloadJson', 'Download JSON')}
              </Button>
            </div>
            {result.byFundSource?.length > 0 && (
              <div>
                <p className="font-medium mt-3">{t('audit.byFundSource', 'By Fund Source')}</p>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {result.byFundSource.map((fs: any, i: number) => (
                    <div key={i} className="rounded border px-3 py-2">
                      <p className="font-medium">{fs.source}</p>
                      <p className="text-xs text-muted-foreground">{t('audit.interventionsCount', '{{count}} interventions', { count: fs.count })} · ₱{Number(fs.amount).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
