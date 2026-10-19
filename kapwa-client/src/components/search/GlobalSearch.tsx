import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

function useOs() {
  return useMemo(() => {
    const ua = navigator.userAgent;
    if (/Mac|iP(hone|ad|od)/i.test(ua)) return 'mac';
    if (/Windows/i.test(ua)) return 'windows';
    if (/Linux/i.test(ua)) return 'linux';
    return 'windows';
  }, []);
}

/** Bolds the part of the name the operator typed, so a hit is visible at a glance. */
function Highlight({ text, term }: { text: string; term: string }) {
  const at = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-transparent font-semibold text-foreground">{text.slice(at, at + term.length)}</mark>
      {text.slice(at + term.length)}
    </>
  );
}

export function GlobalSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const os = useOs();
  const { results, loading } = useDebouncedSearch(query);
  const term = query.trim();
  const showResults = focused && term.length > 0;
  const showHelper = focused && term.length === 0;
  const optionId = (i: number) => `global-search-option-${i}`;

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
    if (term) {
      setFocused(false);
      navigate(`/search?q=${encodeURIComponent(term)}`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showResults) {
      if (e.key === 'Enter') navigateToSearch();
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIdx(i => (i + 1) % Math.max(results.length, 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIdx(i => (i <= 0 ? results.length - 1 : i - 1));
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
        <Input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showResults || showHelper}
          aria-controls={showResults ? 'global-search-results' : undefined}
          aria-autocomplete="list"
          aria-activedescendant={showResults && selectedIdx >= 0 ? optionId(selectedIdx) : undefined}
          aria-label={t('search.ariaLabelDetailed', 'Search clients by name, control number, or barangay')}
          placeholder={t('search.placeholderShort', 'Search clients…')}
          className={cn(
            'h-9 w-60 lg:w-80 rounded-full pl-9 pr-3 bg-muted/50 outline-none transition-all',
            focused ? 'border-ring bg-background shadow-sm' : 'border-transparent hover:bg-muted',
          )}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onKeyDown={handleKeyDown}
        />
        {/* The shortcut hint is for an idle field; while typing it would sit on
            top of the text and add nothing. */}
        {!query && !focused && (
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden lg:inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground pointer-events-none z-10">
            {os === 'mac' ? <span>&#8984;</span> : <span>Ctrl</span>}K
          </kbd>
        )}
      </form>

      {showHelper && (
        <div className="absolute top-full left-0 mt-1 w-[22rem] max-w-[calc(100vw-2rem)] rounded-lg border bg-popover p-3 shadow-lg z-50">
          <p className="text-xs text-muted-foreground">
            {t('search.helpHint', 'Search by client name, control number, or barangay.')}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t('search.helpEnter', 'Press Enter to see every match.')}
          </p>
        </div>
      )}

      {showResults && (
        <div
          id="global-search-results"
          role="listbox"
          aria-label={t('search.resultsLabel', 'Search results')}
          className="absolute top-full left-0 mt-1 w-[24rem] max-w-[calc(100vw-2rem)] rounded-lg border bg-popover shadow-lg z-50 max-h-80 overflow-y-auto"
        >
          {loading ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              {t('search.searching', 'Searching...')}
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              {t('search.noResults', 'No results found for "{{query}}"', { query: term })}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5 text-[11px] text-muted-foreground">
                <span>
                  {t('search.resultCount', '{{count}} result for "{{query}}"', { count: results.length, query: term })}
                </span>
                <span className="hidden sm:inline">
                  {t('search.keyboardHint', '↑↓ move · ↵ open · Esc close')}
                </span>
              </div>
              {results.map((item, i) => (
                <button
                  key={item.id}
                  id={optionId(i)}
                  type="button"
                  role="option"
                  aria-selected={i === selectedIdx}
                  className={cn(
                    'flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                    i === selectedIdx && 'bg-muted',
                  )}
                  onMouseDown={() => { setFocused(false); navigate(`/beneficiaries/${item.id}`); }}
                >
                  <UserRound size={14} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      <Highlight text={item.fullName} term={term} />
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[item.controlNo, item.barangay].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              ))}
              <button
                type="button"
                className="w-full border-t px-3 py-2 text-center text-xs font-medium text-accent transition-colors hover:bg-muted"
                onMouseDown={() => navigateToSearch()}
              >
                {t('search.viewAll', 'View all results')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
