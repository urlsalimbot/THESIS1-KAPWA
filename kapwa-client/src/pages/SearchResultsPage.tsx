import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { Search, ExternalLink, CreditCard } from 'lucide-react';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate, personFullName } from '../lib/format';
import { categoryLabel } from '@/i18n/display';

/**
 * One beneficiary, flattened for the results card. The list endpoint returns
 * the person and household nested; `address` is only present on older payloads
 * (the person's address was normalised into its own table), so the barangay is
 * read from the household and falls back to the tail of `address`.
 */
interface SearchResult {
  id: string;
  fullName: string;
  accessCardCode: string;
  philsysNumber: string;
  barangay: string;
  address: string;
  dob: string;
  age: number;
  gender: string;
  category: string;
  civilStatus: string;
  occupation: string;
  income: string;
  placeOfBirth: string;
  interventionCount: number;
  lastInterventionDate: string;
  household: {
    barangay: string;
    familyMemberCount: number;
    nhtsPrId: string;
  } | null;
}

function mapResult(raw: Record<string, unknown>): SearchResult {
  const address = (raw.address as string) || '';
  const household = (raw.household as Record<string, unknown> | null) || null;
  const dob = (raw.dob as string) || '';
  const computedAge = dob
    ? (() => {
        const today = new Date();
        const b = new Date(dob);
        let a = today.getFullYear() - b.getFullYear();
        if (today < new Date(today.getFullYear(), b.getMonth(), b.getDate())) a--;
        return a;
      })()
    : 0;

  return {
    id: raw.id as string,
    fullName: personFullName(
      raw.firstName as string,
      raw.middleName as string,
      raw.surname as string,
      raw.extension as string,
    ),
    accessCardCode: (raw.accessCardCode as string) || '',
    philsysNumber: (raw.philsysNumber as string) || '',
    // The household carries the barangay; `address` is the fallback for payloads
    // that still inline it.
    barangay: (household?.barangay as string) || address.split(',').pop()?.trim() || '',
    address,
    dob,
    age: Number(raw.age) || computedAge,
    gender: (raw.gender as string) || '',
    category: (raw.category as string) || '',
    civilStatus: (raw.civilStatus as string) || '',
    occupation: (raw.occupation as string) || '',
    income: (raw.estimatedMonthlyIncome as string) || '',
    placeOfBirth: (raw.placeOfBirth as string) || '',
    interventionCount: Number(raw.interventionCount) || 0,
    lastInterventionDate: (raw.lastInterventionDate as string) || '',
    household: household
      ? {
          barangay: (household.barangay as string) || '',
          familyMemberCount: Number(household.familyMemberCount) || 0,
          nhtsPrId: (household.nhtsPrId as string) || '',
        }
      : null,
  };
}

/** Marks the matched part of a value so the reader can see why it came up. */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!text) return null;
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded bg-accent/20 px-0.5 text-foreground">
        {text.slice(at, at + query.length)}
      </mark>
      {text.slice(at + query.length)}
    </>
  );
}

/** Label/value pair. Labels reuse the beneficiary field vocabulary. */
function Field({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className ? `min-w-0 ${className}` : 'min-w-0'}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`break-words text-sm text-foreground ${mono ? 'font-mono tabular-nums' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

export function SearchResultsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const q = searchParams.get('q') || '';
  const [input, setInput] = useState(q);
  const [debounced, setDebounced] = useState(q);

  useEffect(() => {
    setInput(q);
    setDebounced(q);
  }, [q]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (input.trim() !== debounced) {
        setSearchParams(input.trim() ? { q: input.trim() } : {}, { replace: true });
        setDebounced(input.trim());
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [input, debounced, setSearchParams]);

  const swrKey = debounced
    ? queryKeys.beneficiaries.list({ search: debounced, limit: 50 })
    : null;

  const { data, isLoading } = useSWR<{ data: Record<string, unknown>[]; total: number }>(swrKey, {
    keepPreviousData: true,
  });

  const results = useMemo(() => (Array.isArray(data?.data) ? data.data : []).map(mapResult), [data]);

  // The API sends income as a decimal string; anything unparseable is dropped
  // rather than rendered as "₱NaN".
  const money = (value: string) => {
    const n = Number(value);
    return value && Number.isFinite(n) ? `₱${n.toLocaleString()}` : '';
  };

  return (
    <PageShell
      title={t('search.title', 'Search Results')}
      description={
        debounced ? t('search.resultsFor', 'Results for "{{query}}"', { query: debounced }) : ''
      }
    >
      <div className="space-y-6">
        <div className="relative max-w-2xl">
          <Search
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            aria-label={t('search.ariaLabel', 'Search')}
            placeholder={t('search.placeholder', 'Search by name, control no, or barangay...')}
            className="h-12 w-full pl-10 text-base"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
        </div>

        {!debounced && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Search size={48} className="mb-4 opacity-20" aria-hidden="true" />
            <p className="text-sm">{t('search.enterTerm', 'Enter a search term to find beneficiaries')}</p>
          </div>
        )}

        {debounced && isLoading && (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            {t('search.searching', 'Searching...')}
          </div>
        )}

        {debounced && !isLoading && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Search size={48} className="mb-4 opacity-20" aria-hidden="true" />
            <p className="text-sm font-medium">
              {t('search.noResults', 'No results found for "{{query}}"', { query: debounced })}
            </p>
            <p className="mt-1 text-xs">
              {t('search.tryDifferent', 'Try a different name, control number, or barangay')}
            </p>
          </div>
        )}

        {results.length > 0 && (
          <>
            <p className="text-sm text-muted-foreground">
              {t('search.resultCount', '{{count}} results for "{{query}}"', {
                count: results.length,
                query: debounced,
              })}
            </p>

            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {results.map((item) => (
                <li key={item.id}>
                  <Card className="h-full border-border/60">
                    <CardContent className="flex h-full flex-col gap-4 p-5">
                      {/* Who this is: name, category, and the office-issued code */}
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="min-w-0 break-words font-heading text-lg font-semibold tracking-tight">
                          <Highlight text={item.fullName} query={debounced} />
                        </h2>
                        {item.category && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            {categoryLabel(t, item.category)}
                          </Badge>
                        )}
                      </div>

                      {/* The facts that identify and locate a person */}
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                        {item.accessCardCode && (
                          <Field
                            label={t('beneficiaries.accessCard', 'Access Card')}
                            value={item.accessCardCode}
                            mono
                          />
                        )}
                        {item.philsysNumber && (
                          <Field
                            label={t('intake.philsysNumber', 'PhilSys Number')}
                            value={item.philsysNumber}
                            mono
                          />
                        )}
                        {item.dob && (
                          <Field
                            label={t('beneficiaries.dob', 'Date of Birth')}
                            value={formatDate(item.dob)}
                          />
                        )}
                        {item.age > 0 && (
                          <Field label={t('beneficiaries.age', 'Age')} value={String(item.age)} />
                        )}
                        {item.gender && (
                          <Field label={t('beneficiaries.sex', 'Sex')} value={item.gender} />
                        )}
                        {item.civilStatus && (
                          <Field
                            label={t('beneficiaries.civilStatus', 'Civil Status')}
                            value={item.civilStatus}
                          />
                        )}
                        {item.barangay && (
                          <Field
                            label={t('beneficiaries.barangay', 'Barangay')}
                            value={item.barangay}
                          />
                        )}
                        {item.occupation && (
                          <Field
                            label={t('beneficiaries.occupation', 'Occupation')}
                            value={item.occupation}
                          />
                        )}
                        {money(item.income) && (
                          <Field
                            label={t('beneficiaries.monthlyIncome', 'Monthly Income')}
                            value={money(item.income)}
                          />
                        )}
                        {item.placeOfBirth && (
                          <Field
                            label={t('beneficiaries.placeOfBirth', 'Place of Birth')}
                            value={item.placeOfBirth}
                          />
                        )}
                        {item.address && (
                          <Field
                            label={t('beneficiaries.address', 'Address')}
                            value={item.address}
                            className="col-span-2"
                          />
                        )}
                      </dl>

                      {/* Household context — only when the record actually has it */}
                      {item.household &&
                        (item.household.familyMemberCount > 0 || item.household.nhtsPrId) && (
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border/60 pt-3">
                            {item.household.familyMemberCount > 0 && (
                              <Field
                                label={t('analytics.householdSize', 'Household size')}
                                value={String(item.household.familyMemberCount)}
                              />
                            )}
                            {item.household.nhtsPrId && (
                              <Field
                                label={t('nhts.label', 'NHTS-PR / Listahanan ID')}
                                value={item.household.nhtsPrId}
                                mono
                              />
                            )}
                          </dl>
                        )}

                      <div className="mt-auto flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                        {(item.interventionCount > 0 || item.lastInterventionDate) && (
                          <p className="text-xs text-muted-foreground">
                            {item.interventionCount > 0 &&
                              t('search.interventionCount', '{{count}} interventions', {
                                count: item.interventionCount,
                              })}
                            {item.interventionCount > 0 && item.lastInterventionDate ? ' · ' : ''}
                            {item.lastInterventionDate &&
                              t('search.last', 'Last: {{date}}', {
                                date: formatDate(item.lastInterventionDate),
                              })}
                          </p>
                        )}
                        <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:items-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => navigate(`/beneficiaries/${item.id}`)}
                          >
                            {t('search.view', 'View')}
                            <ExternalLink size={14} className="ml-1.5" aria-hidden="true" />
                          </Button>
                          {/* The card a tracer may need in hand. Shown only when one
                              has been issued — the same guard the case view uses. */}
                          {item.accessCardCode && (
                            <Button asChild size="sm" variant="ghost" className="w-full sm:w-auto">
                              <Link to={`/beneficiary/${item.id}/access-card`}>
                                <CreditCard size={14} className="mr-1.5" aria-hidden="true" />
                                {t('caseView.viewAccessCard', 'View Access Card')}
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </PageShell>
  );
}
