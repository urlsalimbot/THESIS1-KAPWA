import { useState, useEffect, useCallback, type FormEvent } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { useAuth } from '../lib/auth-context';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DataTable } from '@/components/data-table';
import { Search, Check, Plus, History, BadgeCheck, Loader2, MapPin, AlertTriangle, CheckCircle2 } from 'lucide-react';
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

interface BeneficiaryResult {
  id: string;
  surname?: string;
  first_name?: string;
  access_card_code?: string | null;
}

/** The API's shape for the paged history endpoint. */
interface HistoryResponse {
  data: AccessCardService[];
  total: number;
}

const TABS: { key: Tab; labelKey: string; labelDefault: string; icon: typeof BadgeCheck }[] = [
  { key: 'verify', labelKey: 'accessCard.verify', labelDefault: 'Verify', icon: BadgeCheck },
  { key: 'assign', labelKey: 'accessCard.assign', labelDefault: 'Assign', icon: Plus },
  { key: 'history', labelKey: 'accessCard.history', labelDefault: 'History', icon: History },
];

export function CoordinatorAccessCardsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('verify');
  const { user } = useAuth();

  return (
    <PageShell
      title={t('accessCard.title', 'Access Cards')}
      description={t('accessCard.coordinatorDescription', 'Verify, assign, and log activities on access cards.')}
    >
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* The server pins every list query to this barangay, so state the scope
            rather than letting a coordinator assume they are seeing city-wide data. */}
        {user?.assignedBarangay && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <MapPin size={14} className="shrink-0" />
            <span>
              {t('accessCard.scopedTo', 'Showing access cards for {{barangay}} only.', {
                barangay: user.assignedBarangay,
              })}
            </span>
          </div>
        )}

        <Tabs value={tab} onValueChange={v => setTab(v as Tab)}>
          <TabsList>
            {TABS.map(({ key, labelKey, labelDefault, icon: Icon }) => (
              <TabsTrigger key={key} value={key}>
                <Icon size={14} className="mr-1" />
                {t(labelKey, labelDefault)}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="verify" className="mt-6">
            <VerifyTab />
          </TabsContent>
          <TabsContent value="assign" className="mt-6">
            <AssignTab />
          </TabsContent>
          <TabsContent value="history" className="mt-6">
            <HistoryTab />
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}

/** Inline error line. Previously these were bare `catch {}` blocks, so a failed
 *  lookup looked identical to a card that simply had no name on file. */
function FormError({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function VerifyTab() {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<{ services: AccessCardService[]; beneficiary: any } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookupWarning, setLookupWarning] = useState<string | null>(null);
  const [justLogged, setJustLogged] = useState<string | null>(null);

  const lookup = useCallback(async (cardCode: string) => {
    setLoading(true);
    setError(null);
    setLookupWarning(null);
    try {
      const services: any = await api.get(`/access-cards/${encodeURIComponent(cardCode)}`);
      let beneficiary = null;
      try {
        const cardData: any = await api.get(
          `/access-cards/beneficiary/${encodeURIComponent(cardCode)}/card`,
        );
        beneficiary = cardData.beneficiary;
      } catch {
        // The card exists but the beneficiary record did not resolve. Say so
        // instead of rendering a nameless card that looks like a data error.
        setLookupWarning(
          t('accessCard.nameUnavailable', 'Card is valid, but the beneficiary record could not be loaded.'),
        );
      }
      setResult({ services: services ?? [], beneficiary });
    } catch {
      setResult(null);
      setError(t('accessCard.notFound', 'Access card not found'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setCode(trimmed);
    // A fresh verification supersedes any earlier "logged" confirmation.
    setJustLogged(null);
    await lookup(trimmed);
  }

  async function handleLogged() {
    // Refresh first, then confirm. Clearing the flag inside `lookup` would wipe
    // the very confirmation the refresh is meant to accompany.
    await lookup(code.trim());
    setJustLogged(t('accessCard.logged', 'Activity logged.'));
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{t('accessCard.verifyCard', 'Verify Card')}</h3>
        </div>
        <CardContent className="p-4 space-y-3">
          <form onSubmit={handleVerify} className="flex gap-2">
            <div className="relative flex-1">
              <label htmlFor="access-card-code" className="sr-only">
                {t('accessCard.enterCode', 'Enter card code')}
              </label>
              <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                id="access-card-code"
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder={t('accessCard.enterCode', 'Enter card code (e.g. NORZ-AC-2026-0001)')}
                className="w-full pl-8"
              />
            </div>
            <Button type="submit" disabled={loading || !code.trim()}>
              {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Search size={14} className="mr-1" />}
              {t('accessCard.verify', 'Verify')}
            </Button>
          </form>
          <FormError>{error}</FormError>
        </CardContent>
      </Card>

      {result && (
        <>
          <FormError>{lookupWarning}</FormError>

          {justLogged && (
            <p role="status" className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 size={14} className="shrink-0" />
              {justLogged}
            </p>
          )}

          {result.beneficiary && (
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="font-semibold">
                  {result.beneficiary.surname}, {result.beneficiary.first_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('accessCard.codeLabel', 'Code: {{code}}', { code })}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-semibold">
                {t('accessCard.serviceHistory', 'Service History ({{count}})', { count: result.services.length })}
              </h3>
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
                          {s.category && (
                            <Badge variant="secondary" className="text-[10px] mr-1">
                              {s.category}
                            </Badge>
                          )}
                          {new Date(s.serviceDate).toLocaleDateString()}
                        </p>
                      </div>
                      {s.cost != null && (
                        <span className="text-sm font-medium tabular-nums">
                          ₱{Number(s.cost).toLocaleString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <ActivityForm cardCode={code} onLogged={handleLogged} />
        </>
      )}
    </div>
  );
}

function ActivityForm({ cardCode, onLogged }: { cardCode: string; onLogged: () => Promise<void> }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState('community_service');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: agencies } = useSWR<{ id: string; code: string; name: string }[]>(queryKeys.agencies.list());

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/access-cards/log', {
        accessCardCode: cardCode,
        serviceRendered: remarks,
        serviceDate,
        category,
        agencyId,
      });
      setRemarks('');
      // Keep the verified card on screen so the coordinator can see the row
      // they just wrote appear in the history below.
      await onLogged();
    } catch {
      setError(t('accessCard.logFailed', 'Failed to log activity. Please try again.'));
    } finally {
      setSubmitting(false);
    }
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
              <label htmlFor="ac-category" className="text-xs font-medium text-muted-foreground">
                {t('accessCard.category', 'Category *')}
              </label>
              <select
                id="ac-category"
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
              <label htmlFor="ac-date" className="text-xs font-medium text-muted-foreground">
                {t('accessCard.date', 'Date *')}
              </label>
              <Input id="ac-date" type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="ac-agency" className="text-xs font-medium text-muted-foreground">
              {t('accessCard.agency', 'Agency *')}
            </label>
            <select
              id="ac-agency"
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
            <label htmlFor="ac-remarks" className="text-xs font-medium text-muted-foreground">
              {t('accessCard.remarks', 'Remarks *')}
            </label>
            <textarea
              id="ac-remarks"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              rows={2}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
              placeholder={t('accessCard.remarksPlaceholder', 'Describe the activity...')}
            />
          </div>
          <FormError>{error}</FormError>
          <Button type="submit" disabled={submitting || !remarks.trim()} size="sm">
            <Check size={14} className="mr-1" />{' '}
            {submitting ? t('accessCard.logging', 'Logging...') : t('accessCard.logActivity', 'Log Activity')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AssignTab() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<BeneficiaryResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignedCode, setAssignedCode] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!search.trim()) return;
    setSearching(true);
    setAssignedCode(null);
    setSearchError(null);
    setAssignError(null);
    try {
      const res: any = await api.get(`/beneficiaries?search=${encodeURIComponent(search.trim())}`);
      const rows = Array.isArray(res) ? res : res?.data || [];
      setResults(rows);
    } catch {
      setResults(null);
      setSearchError(t('accessCard.searchFailed', 'Search failed. Please try again.'));
    } finally {
      setSearching(false);
    }
  }

  async function handleAssign(beneficiaryId: string) {
    setAssigning(beneficiaryId);
    setAssignError(null);
    try {
      const result: any = await api.post(`/access-cards/assign/${beneficiaryId}`);
      setAssignedCode(result.accessCardCode);
      // Reflect the new code in the row without forcing a second search.
      setResults(prev => prev?.map(r => (r.id === beneficiaryId ? { ...r, access_card_code: result.accessCardCode } : r)) ?? prev);
    } catch {
      setAssignError(t('accessCard.assignFailed', 'Could not assign a card. Please try again.'));
    } finally {
      setAssigning(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{t('accessCard.searchBeneficiary', 'Search Beneficiary')}</h3>
        </div>
        <CardContent className="p-4 space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <label htmlFor="access-card-beneficiary-search" className="sr-only">
                {t('accessCard.searchByName', 'Search by name')}
              </label>
              <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                id="access-card-beneficiary-search"
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('accessCard.searchByName', 'Search by name...')}
                className="w-full pl-8"
              />
            </div>
            <Button type="submit" disabled={searching || !search.trim()}>
              {searching ? <Loader2 size={14} className="animate-spin mr-1" /> : <Search size={14} className="mr-1" />}
              {t('accessCard.search', 'Search')}
            </Button>
          </form>
          <FormError>{searchError}</FormError>
        </CardContent>
      </Card>

      {assignedCode && (
        <div
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950"
        >
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            {t('accessCard.cardAssigned', 'Card assigned!')}
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
            {t('accessCard.codeLabel', 'Code: {{code}}', { code: assignedCode })}
          </p>
        </div>
      )}

      <FormError>{assignError}</FormError>

      {results && (
        <Card>
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">{t('accessCard.results', 'Results')}</h3>
          </div>
          {results.length === 0 ? (
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                {t('accessCard.noBeneficiaries', 'No beneficiaries matched that search.')}
              </p>
            </CardContent>
          ) : (
            <div className="divide-y">
              {results.map((r: BeneficiaryResult) => (
                <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {r.surname}, {r.first_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.access_card_code || t('accessCard.noCardAssigned', 'No card assigned')}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAssign(r.id)}
                    disabled={assigning === r.id || !!r.access_card_code}
                    variant={r.access_card_code ? 'outline' : 'default'}
                  >
                    {r.access_card_code
                      ? t('accessCard.hasCard', 'Has Card')
                      : assigning === r.id
                        ? t('accessCard.assigning', 'Assigning...')
                        : t('accessCard.assignCard', 'Assign Card')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function HistoryTab() {
  const { t } = useTranslation();
  const [data, setData] = useState<AccessCardService[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  // Refetch on pageSize too — previously only pageIndex was a dependency, so
  // changing the page size refetched the old window against the new limit.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res: HistoryResponse = await api.get(
          `/access-cards?page=${pagination.pageIndex + 1}&limit=${pagination.pageSize}`,
        );
        if (cancelled) return;
        setData(res?.data || []);
        setTotal(res?.total ?? 0);
      } catch {
        if (cancelled) return;
        setData([]);
        setTotal(0);
        setError(t('accessCard.historyFailed', 'Could not load service history.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pagination.pageIndex, pagination.pageSize, t]);

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

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 p-4">
        <FormError>{error}</FormError>
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      // The server-reported total, not the current page length — using the page
      // length pinned pageCount to 1 and made page 2 unreachable.
      rowCount={total}
      loading={loading}
      pagination={pagination}
      onPaginationChange={setPagination}
      sorting={[]}
    />
  );
}
