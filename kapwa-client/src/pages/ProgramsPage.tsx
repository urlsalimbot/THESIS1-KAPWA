import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Plus, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface ApprovalStep {
  stepName: string;
  approverRole: string;
  slaDays: number;
  order: number;
}

interface ProgramRecord {
  id: string;
  name: string;
  category?: string;
  waitingPeriodDays?: number;
  legalBasis?: string;
  requiredDocuments?: string[];
  fundSources?: string[];
  approvalWorkflow?: ApprovalStep[];
  formTemplate?: Record<string, any>;
  formVersion: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function ProgramsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [records, setRecords] = useState<ProgramRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, []);

  async function load(signal?: AbortSignal) {
    setLoading(true);
    try {
      const data = await api.get<ProgramRecord[]>('/programs');
      setRecords(data || []);
    } catch { setRecords([]); }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm(t('programs.deleteConfirm', 'Delete this program? This action cannot be undone.'))) return;
    try {
      await api.del(`/programs/${id}`);
      setMsg(t('programs.deleted', 'Program deleted'));
      load();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : t('programs.deleteFailed', 'Error deleting program'));
    }
  }

  const filteredRecords = records.filter(r =>
    !searchTerm ||
    r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PageShell title={t('programs.title', 'Programs')} description={t('programs.description', 'Configure intervention programs')}>
      {msg && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-4">{msg}</div>
      )}

      <div className="flex items-center justify-between gap-3 mb-4">
        <Button onClick={() => navigate('/admin/programs/new')} aria-label={t('programs.newProgram', 'New Program')} className="gap-1.5">
          <Plus size={16} /> {t('programs.newProgram', 'New Program')}
        </Button>
        <Input type="text" placeholder={t('programs.searchPlaceholder', 'Search programs...')} className="max-w-xs h-9"
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)} aria-label={t('programs.search', 'Search programs')} />
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">{t('programs.loading', 'Loading programs...')}</div>
      ) : filteredRecords.length === 0 ? (
        <div className="rounded-lg border bg-card shadow-sm text-center py-12 text-muted-foreground">
          <FileText className="mx-auto mb-2" size={32} />
          <p>{t('programs.empty', 'No programs configured yet. Create your first intervention program.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map(r => (
            <div key={r.id} className="rounded-lg border bg-card shadow-sm overflow-hidden p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${r.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                  <div>
                    <span className="font-semibold text-foreground">{r.name}</span>
                    {r.category && <span className="ml-2 text-xs text-muted-foreground">| {r.category}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.legalBasis && <span className="text-xs text-muted-foreground hidden md:inline">{r.legalBasis}</span>}
                  <Badge variant={r.isActive ? 'default' : 'secondary'} className={`shrink-0 ${r.isActive ? 'bg-emerald-500' : ''}`}>
                    {r.isActive ? t('programs.active', 'Active') : t('programs.inactive', 'Inactive')}
                  </Badge>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {r.waitingPeriodDays != null && <span>{t('programs.wait', 'Wait: {{days}}d', { days: r.waitingPeriodDays })}</span>}
                {r.requiredDocuments?.length ? <span>{t('programs.docsCount', 'Docs: {{count}}', { count: r.requiredDocuments.length })}</span> : null}
                {r.fundSources?.length ? <span>{t('programs.funds', 'Funds: {{sources}}', { sources: r.fundSources.join(', ') })}</span> : null}
                {r.approvalWorkflow?.length ? <span>{t('programs.stepsCount', 'Steps: {{count}}', { count: r.approvalWorkflow.length })}</span> : null}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/programs/${r.id}`)}
                  aria-label={t('programs.viewDetails', 'View details')} className="h-8">
                  <ExternalLink size={14} className="mr-1" /> {t('programs.viewDetails', 'View Details')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}
                  aria-label={t('programs.delete', 'Delete')} className="h-8 text-destructive hover:text-destructive">{t('programs.delete', 'Delete')}</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
