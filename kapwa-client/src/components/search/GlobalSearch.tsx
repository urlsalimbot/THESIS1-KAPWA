import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';

export function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { results, loading } = useDebouncedSearch(query);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  const handleSelect = useCallback(
    (id: string) => {
      setOpen(false);
      navigate(`/beneficiaries/${id}`);
    },
    [navigate]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="hidden md:inline-flex h-9 w-56 items-center gap-2 rounded-full bg-muted/50 px-3 text-sm text-muted-foreground hover:bg-muted transition-colors border-none"
          aria-label="Search beneficiaries"
        >
          <Search size={16} className="shrink-0" />
          <span className="flex-1 text-left">Search records...</span>
          <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">&#8984;</span>K
          </kbd>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name, control no, or barangay..."
            value={query}
            onValueChange={setQuery}
            role="combobox"
            aria-label="Search beneficiaries"
          />
          <CommandList>
            {loading && (
              <div className="py-6 text-center text-sm text-muted-foreground">Searching...</div>
            )}
            {!loading && query.trim() && results.length === 0 && (
              <CommandEmpty>No results found.</CommandEmpty>
            )}
            {results.map((item) => (
              <CommandItem
                key={item.id}
                value={item.id}
                onSelect={() => handleSelect(item.id)}
                className="cursor-pointer"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{item.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.controlNo} &middot; {item.barangay}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
