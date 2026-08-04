import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';

export interface SearchResult {
  id: string;
  fullName: string;
  controlNo: string;
  barangay: string;
}

function mapToSearchResult(raw: Record<string, unknown>): SearchResult {
  const address = (raw.address as string) || '';
  return {
    id: raw.id as string,
    fullName: `${(raw.firstName as string) || ''} ${(raw.surname as string) || ''}`.trim(),
    controlNo: (raw.accessCardCode as string) || (raw.philsysNumber as string) || '',
    barangay: address.split(',').pop()?.trim() || '',
  };
}

export function useDebouncedSearch(
  query: string,
  delay = 300,
  limit = 10,
  fetcher?: (q: string) => Promise<SearchResult[]>,
) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), delay);
    return () => clearTimeout(t);
  }, [query, delay]);

  const trimmed = debouncedQuery.trim();
  const swrKey: [string, string] | [string, { search: string; limit: number }] | null = trimmed
    ? fetcher
      ? ['debounced-search', trimmed]
      : ['beneficiaries', { search: trimmed, limit }]
    : null;

  const { data, isLoading } = useSWR<
    SearchResult[] | { data: Record<string, unknown>[] } | Record<string, unknown>[]
  >(swrKey, fetcher != null ? (key: readonly unknown[]) => fetcher(String((key as readonly unknown[])[1])) : null, {
    keepPreviousData: true,
  });

  const results = useMemo(() => {
    if (fetcher) return (data as SearchResult[]) || [];
    const list = Array.isArray(data)
      ? (data as Record<string, unknown>[])
      : (data as { data?: Record<string, unknown>[] } | undefined)?.data || [];
    return list.map(mapToSearchResult);
  }, [data, fetcher]);

  return { results, loading: isLoading };
}
