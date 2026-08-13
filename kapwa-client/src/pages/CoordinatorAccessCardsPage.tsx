import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/data-table';
import { Search, Check, Plus, History, BadgeCheck, Loader2 } from 'lucide-react';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';

type Tab = 'verify' | 'assign' | 'history';

interface AccessCardService {
  id: string;
  accessCardCode: string;
  serviceDate: string;
  serviceRendered: string;
  category: string;
  cost?: number;
  agency?: string;
  workerNameSign?: string;
  sourceBarangay?: string;
}

export function CoordinatorAccessCardsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('verify');

  return (
    <PageShell title={t('accessCard.title', 'Access Cards')} description={t('accessCard.coordinatorDescription', 'Verify, assign, and log activities on access cards.')}>
      <div className="flex gap-1 border-b mb-6">
        {(['verify', 'assign', 'history'] as const).map(tabKey => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === tabKey ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tabKey === 'verify' && <BadgeCheck size={14} className="inline mr-1" />}
            {tabKey === 'assign' && <Plus size={14} className="inline mr-1" />}
            {tabKey === 'history' && <History size={14} className="inline mr-1" />}
            {tabKey === 'verify' ? t('accessCard.verify', 'Verify') : tabKey === 'assign' ? t('accessCard.assign', 'Assign') : t('accessCard.history', 'History')}
          </button>
        ))}
      </div>

      {tab === 'verify' && <VerifyTab />}
      {tab === 'assign' && <AssignTab />}
      {tab === 'history' && <HistoryTab />}
    </PageShell>
  );
}

function VerifyTab() {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const services: any = await api.get(`/access-cards/${code.trim()}`);
      let beneficiary = null;
      try {
        const cardData: any = await api.get(`/access-cards/beneficiary/${encodeURIComponent(code.trim())}/card`);
        beneficiary = cardData.beneficiary;
      } catch {}
      setResult({ services, beneficiary });
    } catch {
      setError(t('accessCard.notFound', 'Access card not found'));
    }
    setLoading(false);
  }

  return (
    <div className="max-w-xl space-y-6">
      <Card>
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{t('accessCard.verifyCard', 'Verify Card')}</h3>
        </div>
        <CardContent className="p-4">
          <form onSubmit={handleVerify} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder={t('accessCard.enterCode', 'Enter card code (e.g. NORZ-AC-2026-0001)')}
                className="w-full pl-8"
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Search size={14} className="mr-1" />}
              {t('accessCard.verify', 'Verify')}
            </Button>
          </form>
          {error && <p className="text-destructive text-sm mt-2">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <>
          {result.beneficiary && (
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="font-semibold">{result.beneficiary.surname}, {result.beneficiary.first_name}</p>
                <p className="text-xs text-muted-foreground">{t('accessCard.codeLabel', 'Code: {{code}}', { code })}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-semibold">{t('accessCard.serviceHistory', 'Service History ({{count}})', { count: result.services.length })}</h3>
            </div>
            <CardContent className="p-4">
              {result.services.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('accessCard.noServices', 'No services logged yet.')}</p>
              ) : (
                <div className="divide-y">
                  {result.services.map((s: AccessCardService) => (
                    <div key={s.id} className="py-3 flex justify-between items-start first:pt-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium">{s.serviceRendered}</p>
                        <p className="text-xs text-muted-foreground">
                          <Badge variant="secondary" className="text-[10px] mr-1">{s.category}</Badge>
                          {new Date(s.serviceDate).toLocaleDateString()}
                        </p>
                      </div>
                      {s.cost && <span className="text-sm font-medium tabular-nums">₱{Number(s.cost).toLocaleString()}</span>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <ActivityForm cardCode={code} onLogged={() => { setResult(null); setCode(''); }} />
        </>
      )}
    </div>
  );
}

function ActivityForm({ cardCode, onLogged }: { cardCode: string; onLogged: () => void }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState('community_service');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { data: agencies } = useSWR<{ id: string; code: string; name: string }[]>(queryKeys.agencies.list());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/access-cards/log', {
        accessCardCode: cardCode,
        serviceRendered: remarks,
        serviceDate,
        category,
        agencyId,
      });
      onLogged();
    } catch {}
    setSubmitting(false);
  }

  return (
    <Card>
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{t('accessCard.logActivity', 'Log Activity')}</h3>
      </div>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('accessCard.category', 'Category *')}</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="community_service">{t('accessCard.catCommunity', 'Community Service')}</option>
                <option value="seminar">{t('accessCard.catSeminar', 'Seminar')}</option>
                <option value="distribution">{t('accessCard.catDistribution', 'Distribution')}</option>
                <option value="referral">{t('accessCard.catReferral', 'Referral')}</option>
                <option value="case_service">{t('accessCard.catCaseService', 'Case Service')}</option>
                <option value="other">{t('accessCard.catOther', 'Other')}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('accessCard.date', 'Date *')}</label>
              <Input type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t('accessCard.agency', 'Agency *')}</label>
            <select
              value={agencyId}
              onChange={e => setAgencyId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            >
              <option value="">{t('accessCard.selectAgency', 'Select agency...')}</option>
              {(agencies || []).map(a => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t('accessCard.remarks', 'Remarks *')}</label>
            <textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              rows={2}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
              placeholder={t('accessCard.remarksPlaceholder', 'Describe the activity...')}
            />
          </div>
          <Button type="submit" disabled={submitting || !remarks.trim()} size="sm">
            <Check size={14} className="mr-1" /> {submitting ? t('accessCard.logging', 'Logging...') : t('accessCard.logActivity', 'Log Activity')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AssignTab() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignedCode, setAssignedCode] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) return;
    setSearching(true);
    setAssignedCode(null);
    try {
      const res: any = await api.get(`/beneficiaries?search=${encodeURIComponent(search)}`);
      setResults(Array.isArray(res) ? res : res?.data || []);
    } catch {
      setResults([]);
    }
    setSearching(false);
  }

  async function handleAssign(beneficiaryId: string) {
    setAssigning(beneficiaryId);
    try {
      const result: any = await api.post(`/access-cards/assign/${beneficiaryId}`);
      setAssignedCode(result.accessCardCode);
    } catch {}
    setAssigning(null);
  }

  return (
    <div className="max-w-xl space-y-6">
      <Card>
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{t('accessCard.searchBeneficiary', 'Search Beneficiary')}</h3>
        </div>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('accessCard.searchByName', 'Search by name...')}
                className="w-full pl-8"
              />
            </div>
            <Button type="submit" disabled={searching}>
              {searching ? <Loader2 size={14} className="animate-spin mr-1" /> : <Search size={14} className="mr-1" />}
              {t('accessCard.search', 'Search')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {assignedCode && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-green-800">{t('accessCard.cardAssigned', 'Card assigned!')}</p>
            <p className="text-xs text-green-700 mt-1">{t('accessCard.codeLabel', 'Code: {{code}}', { code: assignedCode })}</p>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card>
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">{t('accessCard.results', 'Results')}</h3>
          </div>
          <div className="divide-y">
            {results.map((r: any) => (
              <div key={r.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{r.surname}, {r.first_name}</p>
                  <p className="text-xs text-muted-foreground">{r.access_card_code || t('accessCard.noCardAssigned', 'No card assigned')}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAssign(r.id)}
                  disabled={assigning === r.id || !!r.access_card_code}
                  variant={r.access_card_code ? 'outline' : 'default'}
                >
                  {r.access_card_code ? t('accessCard.hasCard', 'Has Card') : assigning === r.id ? t('accessCard.assigning', 'Assigning...') : t('accessCard.assignCard', 'Assign Card')}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function HistoryTab() {
  const { t } = useTranslation();
  const [data, setData] = useState<AccessCardService[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  useEffect(() => {
    loadHistory();
  }, [pagination.pageIndex]);

  async function loadHistory() {
    try {
      const res: any = await api.get(
        `/access-cards?page=${pagination.pageIndex + 1}&limit=${pagination.pageSize}`
      );
      setData(res?.data || []);
    } catch {}
    setLoading(false);
  }

  const columns: ColumnDef<AccessCardService>[] = [
    { accessorKey: 'accessCardCode', header: t('accessCard.cardCode', 'Card Code') },
    { accessorKey: 'serviceRendered', header: t('accessCard.service', 'Service') },
    { accessorKey: 'category', header: t('accessCard.category', 'Category') },
    { accessorKey: 'sourceBarangay', header: t('accessCard.barangay', 'Barangay') },
    {
      accessorKey: 'serviceDate',
      header: t('accessCard.date', 'Date'),
      cell: ({ row }) => new Date(row.original.serviceDate).toLocaleDateString(),
    },
  ];

  if (loading) return <div className="text-center py-8 text-muted-foreground">{t('accessCard.loading', 'Loading...')}</div>;

  return (
    <Card>
      <CardContent className="p-4">
        <DataTable columns={columns} data={data} rowCount={data.length} pagination={pagination} onPaginationChange={setPagination} sorting={[]} />
      </CardContent>
    </Card>
  );
}
