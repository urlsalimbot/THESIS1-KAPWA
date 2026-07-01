import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface SearchResult {
  id: string;
  fullName: string;
  controlNo: string;
  barangay: string;
}

export function useDebouncedSearch(query: string, delay = 300, limit = 10) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const controller = new AbortController();
      try {
        const token = localStorage.getItem('kapwa_token');
        const q = encodeURIComponent(query.trim());
        const res = await fetch(`${API_URL}/beneficiaries?search=${q}&limit=${limit}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data.data ?? data ?? []);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setResults([]);
      } finally {
        setLoading(false);
      }
      return () => controller.abort();
    }, delay);

    return () => clearTimeout(timer);
  }, [query, delay, limit]);

  return { results, loading };
}
