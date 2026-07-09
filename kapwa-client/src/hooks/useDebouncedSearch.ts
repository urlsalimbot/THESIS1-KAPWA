import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { queryKeys } from '../lib/query-keys';

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

export function useDebouncedSearch(query: string, delay = 300, limit = 10) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), delay);
    return () => clearTimeout(t);
  }, [query, delay]);

  const trimmed = debouncedQuery.trim();
  const swrKey = trimmed
    ? queryKeys.beneficiaries.list({ search: trimmed, limit })
    : null;

  const { data, isLoading } = useSWR<Record<string, unknown>[]>(swrKey, {
    keepPreviousData: true,
  });

  const results = useMemo(() => (data || []).map(mapToSearchResult), [data]);

  return { results, loading: isLoading };
}
