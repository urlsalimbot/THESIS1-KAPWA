import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';

function useOs() {
  return useMemo(() => {
    const ua = navigator.userAgent;
    if (/Mac|iP(hone|ad|od)/i.test(ua)) return 'mac';
    if (/Windows/i.test(ua)) return 'windows';
    if (/Linux/i.test(ua)) return 'linux';
    return 'windows';
  }, []);
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const os = useOs();
  const { results, loading } = useDebouncedSearch(query);
  const showDropdown = focused && query.trim().length > 0;

  useEffect(() => {
    setSelectedIdx(-1);
  }, [results]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  function navigateToSearch() {
    const trimmed = query.trim();
    if (trimmed) {
      setFocused(false);
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown) {
      if (e.key === 'Enter') navigateToSearch();
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIdx(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIdx(i => Math.max(i - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIdx >= 0 && selectedIdx < results.length) {
          setFocused(false);
          navigate(`/beneficiaries/${results[selectedIdx].id}`);
        } else {
          navigateToSearch();
        }
        break;
      case 'Escape':
        setFocused(false);
        inputRef.current?.blur();
        break;
    }
  }

  return (
    <div className="relative">
      <form onSubmit={e => { e.preventDefault(); navigateToSearch(); }}>
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-label="Search beneficiaries"
          placeholder="Search records..."
          className={`h-9 w-56 lg:w-72 rounded-full border pl-9 pr-10 text-sm bg-muted/50 text-foreground placeholder:text-muted-foreground outline-none transition-colors ${focused ? 'border-ring bg-background' : 'border-transparent hover:bg-muted'}`}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onKeyDown={handleKeyDown}
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground pointer-events-none z-10">
          {os === 'mac' ? <span className="text-xs">&#8984;</span> : <span className="text-xs">Ctrl</span>}K
        </kbd>
      </form>

      {showDropdown && (
        <div ref={listRef} className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {loading && (
            <div className="px-3 py-4 text-xs text-center text-muted-foreground">Searching...</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-4 text-xs text-center text-muted-foreground">No results found.</div>
          )}
          {results.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={`w-full text-left px-3 py-2.5 flex flex-col gap-0.5 hover:bg-muted transition-colors text-sm ${i === selectedIdx ? 'bg-muted' : ''}`}
              onMouseDown={() => { setFocused(false); navigate(`/beneficiaries/${item.id}`); }}
            >
              <span className="font-medium truncate">{item.fullName}</span>
              <span className="text-xs text-muted-foreground truncate">
                {item.controlNo && <>{item.controlNo} &middot; </>}{item.barangay}
              </span>
            </button>
          ))}
          {results.length > 0 && (
            <button
              type="button"
              className="w-full text-center px-3 py-2 text-xs font-medium text-accent border-t hover:bg-muted transition-colors"
              onMouseDown={() => navigateToSearch()}
            >
              View all results
            </button>
          )}
        </div>
      )}
    </div>
  );
}
