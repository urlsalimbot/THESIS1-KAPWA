import useSWR from 'swr';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

/** A service an admin added to the intervention catalog. */
export interface CustomServiceType {
  code: string;
  label: string;
  isFinancial: boolean;
  isActive: boolean;
}

/**
 * The custom half of the intervention catalog. Built-in services live in
 * `lib/constants.ts` (and the national vocabulary) — this is only what an admin
 * added, with the label and money flag the built-ins get from i18n.
 */
export function useInterventionCatalog() {
  const { data, isLoading, mutate } = useSWR<CustomServiceType[] | null>(
    queryKeys.interventionCatalog.list(),
    () => api.get<CustomServiceType[]>('/intervention-catalog'),
  );
  // `?? []`, not a destructuring default: a fetcher that resolves null (an empty
  // body, a proxy) would otherwise hand the callers null and crash on .filter.
  return { services: data ?? [], isLoading, mutate };
}
