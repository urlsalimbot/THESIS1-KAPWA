import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const DARK_QUERY = '(prefers-color-scheme: dark)';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

function resolve(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme;
}

const STORAGE_KEY = 'kapwa-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try { return (localStorage.getItem(STORAGE_KEY) as Theme) || 'system'; }
    catch { return 'system'; }
  });

  const [resolvedTheme, setResolved] = useState<'light' | 'dark'>(() => {
    const r = resolve(theme);
    document.documentElement.classList.toggle('dark', r === 'dark');
    return r;
  });

  useEffect(() => {
    const apply = (t: Theme) => {
      const r = resolve(t);
      setResolved(r);
      document.documentElement.classList.toggle('dark', r === 'dark');
    };
    apply(theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
    if (theme !== 'system' || typeof window.matchMedia !== 'function') return;

    const mql = window.matchMedia(DARK_QUERY);
    const onChange = () => apply('system');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) return { theme: 'system', resolvedTheme: getSystemTheme(), setTheme: () => {} };
  return ctx;
}
