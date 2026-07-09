import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { Search, ExternalLink } from 'lucide-react';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SearchResult {
  id: string;
  fullName: string;
  controlNo: string;
  barangay: string;
  address: string;
  age: number;
  gender: string;
  category: string;
  interventionCount: number;
  lastInterventionDate: string;
}

function mapResult(raw: Record<string, unknown>): SearchResult {
  const address = (raw.address as string) || '';
  const dob = raw.dob as string;
  const age = dob ? (() => { const today = new Date(); const b = new Date(dob); let a = today.getFullYear() - b.getFullYear(); if (today < new Date(today.getFullYear(), b.getMonth(), b.getDate())) a--; return a; })() : 0;
  return {
    id: raw.id as string,
    fullName: `${(raw.firstName as string) || ''} ${(raw.surname as string) || ''}`.trim(),
    controlNo: (raw.accessCardCode as string) || (raw.philsysNumber as string) || '',
    barangay: address.split(',').pop()?.trim() || '',
    address,
    age,
    gender: (raw.gender as string) || '',
    category: (raw.category as string) || '',
    interventionCount: (raw.interventionCount as number) || 0,
    lastInterventionDate: (raw.lastInterventionDate as string) || '',
  };
}

export function SearchResultsPage() {
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
    const t = setTimeout(() => {
      if (input.trim() !== debounced) {
        setSearchParams(input.trim() ? { q: input.trim() } : {}, { replace: true });
        setDebounced(input.trim());
      }
    }, 300);
    return () => clearTimeout(t);
  }, [input, debounced, setSearchParams]);

  const swrKey = debounced
    ? queryKeys.beneficiaries.list({ search: debounced, limit: 50 })
    : null;

  const { data, isLoading } = useSWR<Record<string, unknown>[]>(swrKey, {
    keepPreviousData: true,
  });

  const results = useMemo(() => (data || []).map(mapResult), [data]);

  return (
    <PageShell title="Search Results" description={debounced ? `Results for "${debounced}"` : ''}>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Search input */}
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            aria-label="Search"
            placeholder="Search by name, control no, or barangay..."
            className="w-full pl-10 h-12 text-base"
            value={input}
            onChange={e => setInput(e.target.value)}
            autoFocus
          />
        </div>

        {!debounced && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Search size={48} className="mb-4 opacity-20" />
            <p className="text-sm">Enter a search term to find beneficiaries</p>
          </div>
        )}

        {debounced && isLoading && (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Searching...</div>
        )}

        {debounced && !isLoading && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Search size={48} className="mb-4 opacity-20" />
            <p className="text-sm font-medium">No results found for "{debounced}"</p>
            <p className="text-xs mt-1">Try a different name, control number, or barangay</p>
          </div>
        )}

        {results.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{results.length} result{results.length !== 1 ? 's' : ''} for "{debounced}"</p>
            </div>
            <div className="rounded-lg border divide-y">
              {results.map(item => (
                <div key={item.id} className="px-5 py-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{item.fullName}</p>
                        {item.category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{item.category}</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {item.controlNo && <span>{item.controlNo}</span>}
                        {item.age > 0 && <span>{item.age} yrs</span>}
                        {item.gender && <span>{item.gender}</span>}
                        <span>{item.barangay}</span>
                      </div>
                      <p className="text-xs text-muted-foreground/70 truncate max-w-lg">{item.address}</p>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">{item.interventionCount} intervention{item.interventionCount !== 1 ? 's' : ''}</span>
                        {item.lastInterventionDate && (
                          <span className="text-muted-foreground">Last: {new Date(item.lastInterventionDate).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="shrink-0 mt-0.5" onClick={() => navigate(`/beneficiaries/${item.id}`)}>
                      View <ExternalLink size={14} className="ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
