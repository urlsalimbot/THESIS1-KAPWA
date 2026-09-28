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
import { AccessCardCategorySelect } from '@/components/cards/AccessCardCategorySelect';
import type { AccessCardCategory } from '@/lib/constants';
import { Search, Check, History, BadgeCheck, Loader2, MapPin, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { formatDate, todayInManila } from '../lib/format';

type Tab = 'verify' | 'history';

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

/** The API's shape for the paged history endpoint. */
interface HistoryResponse {
  data: AccessCardService[];
  total: number;
}

const TABS: { key: Tab; labelKey: string; labelDefault: string; icon: typeof BadgeCheck }[] = [
  { key: 'verify', labelKey: 'accessCard.verify', labelDefault: 'Verify', icon: BadgeCheck },
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
  // The code the server actually confirmed, which is not necessarily what is in
  // the box right now. `accessCardCode` is only `z.string().min(1)` server-side,
  // so the endpoint does not re-check that a posted code belongs to the card
  // that was just verified. Writing against the live input meant that editing
  // the text after a lookup silently filed the service against an unverified
  // code, and the row then never showed up in the history on screen.
  const [verifiedCode, setVerifiedCode] = useState('');
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
      setVerifiedCode(cardCode);
    } catch {
      setResult(null);
      // A failed lookup verifies nothing, so no card is on screen to log against.
      setVerifiedCode('');
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
    // the very confirmation the refresh is meant to accompany. Re-reads
    // `verifiedCode` because that is the card the row was just written to.
    await lookup(verifiedCode);
    setJustLogged(t('accessCard.logged', 'Activity logged.'));
  }

  // The box is still editable so a coordinator can start the next lookup, but
  // anything that is not a re-verification of what is on screen cannot be
  // written.
  const codeMatchesVerified = code.trim() === verifiedCode;

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
                  {t('accessCard.codeLabel', 'Code: {{code}}', { code: verifiedCode })}
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
                          {formatDate(s.serviceDate)}
                        </p>
                      </div>
                      {s.cost != null && (
                        <span className="text-sm font-medium tabular-nums">
                          ₱{s.cost.toLocaleString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {!codeMatchesVerified && (
            <FormError>
              {t(
                'accessCard.codeChanged',
                'The card code no longer matches the card on screen. Verify it again before logging an activity.',
              )}
            </FormError>
          )}

          <ActivityForm
            cardCode={verifiedCode}
            canSubmit={codeMatchesVerified}
            onLogged={handleLogged}
          />
        </>
      )}
    </div>
  );
}

function ActivityForm({
  cardCode,
  canSubmit,
  onLogged,
}: {
  cardCode: string;
  canSubmit: boolean;
  onLogged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<AccessCardCategory>('community_service');
  // Manila's date, not UTC's — between 00:00 and 08:00 local the UTC date is
  // already yesterday, so the old default pre-filled the wrong day.
  const [serviceDate, setServiceDate] = useState(() => todayInManila());
  const [remarks, setRemarks] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: agencies } = useSWR<{ id: string; code: string; name: string }[]>(queryKeys.agencies.list());

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Belt and braces: the button is disabled, but a submit can still arrive
    // from a keyboard or an autofill without the click.
    if (!canSubmit) return;
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
                {t('accessCard.category', 'Category')}
              </label>
              <AccessCardCategorySelect
                id="ac-category"
                value={category}
                onChange={setCategory}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
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
          <Button type="submit" disabled={submitting || !remarks.trim() || !canSubmit} size="sm">
            <Check size={14} className="mr-1" />{' '}
            {submitting ? t('accessCard.logging', 'Logging...') : t('accessCard.logActivity', 'Log Activity')}
          </Button>
        </form>
      </CardContent>
    </Card>
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
      cell: ({ row }) => formatDate(row.original.serviceDate),
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
