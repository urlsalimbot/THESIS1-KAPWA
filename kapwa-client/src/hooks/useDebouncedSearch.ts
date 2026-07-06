import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { queryKeys } from '../lib/query-keys';

interface SearchResult {
  id: string;
  fullName: string;
  controlNo: string;
  barangay: string;
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

  const { data, isLoading } = useSWR<SearchResult[]>(swrKey, {
    keepPreviousData: true,
  });

  return { results: data || [], loading: isLoading };
}
