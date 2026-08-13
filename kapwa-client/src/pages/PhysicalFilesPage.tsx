import { useState, useEffect } from 'react';
import { FileText, Search, QrCode } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PhysicalFile {
  id: string;
  interventionId: string;
  cabinet: string;
  folder: string;
  shelf: string;
  qrHash?: string;
  notes?: string;
  intervention?: { serviceName: string; caseId: string };
  createdAt: string;
}

export function PhysicalFilesPage() {
  const { t } = useTranslation();
  const [records, setRecords] = useState<PhysicalFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { load(); }, []);

  async function load(q?: string) {
    setLoading(true);
    try {
      const data = q
        ? await api.get<PhysicalFile[]>(`/physical-files/search?q=${encodeURIComponent(q)}`)
        : await api.get<PhysicalFile[]>('/physical-files');
      setRecords(data || []);
    } catch { setRecords([]); }
    setLoading(false);
  }

  function handleSearch() { load(searchQuery); }

  return (
    <PageShell title={t('physicalFiles.title', 'Physical Filing')} description={t('physicalFiles.description', 'Browse Cabinet / Folder / Shelf locations')}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex gap-2">
          <Input type="text" placeholder={t('physicalFiles.searchPlaceholder', 'Search cabinet/folder/shelf...')} className="max-w-xs h-9"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }} />
          <Button size="sm" variant="outline" onClick={handleSearch}>
            <Search size={14} className="mr-1" /> {t('physicalFiles.search', 'Search')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">{t('physicalFiles.loading', 'Loading...')}</div>
      ) : records.length === 0 ? (
        <div className="rounded-lg border bg-card shadow-sm text-center py-12 text-muted-foreground">
          <FileText className="mx-auto mb-2" size={32} />
          <p>{t('physicalFiles.empty', 'No physical files. Filing locations appear when an intervention requires documents.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(r => (
            <div key={r.id} className="rounded-lg border bg-card shadow-sm overflow-hidden p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold">{r.cabinet} / {r.folder} / {r.shelf}</span>
                  <span className="ml-3 text-sm text-muted-foreground">
                    {r.intervention?.serviceName || t('physicalFiles.unknownIntervention', 'Unknown intervention')}
                  </span>
                </div>
                {r.qrHash && <QrCode size={16} className="text-muted-foreground" />}
              </div>
              {r.notes && <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p>}
              <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                <span>{t('physicalFiles.case', 'Case: {{caseId}}', { caseId: r.intervention?.caseId || 'N/A' })}</span>
                <span>{t('physicalFiles.filed', 'Filed: {{date}}', { date: new Date(r.createdAt).toLocaleDateString() })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
