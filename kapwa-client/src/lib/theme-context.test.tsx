import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from './theme-context';

interface MatchMediaMock {
  matches: boolean;
  media: string;
  onchange: null;
  addEventListener: (type: string, cb: EventListener) => void;
  removeEventListener: (type: string, cb: EventListener) => void;
  addListener: (cb: EventListener) => void;
  removeListener: (cb: EventListener) => void;
  dispatchEvent: () => boolean;
  fire: (matches: boolean) => void;
}

function installMatchMedia(initialMatches: boolean): MatchMediaMock {
  const listeners = new Set<EventListener>();
  const mql: MatchMediaMock = {
    matches: initialMatches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (type, cb) => {
      if (type === 'change') listeners.add(cb);
    },
    removeEventListener: (type, cb) => {
      if (type === 'change') listeners.delete(cb);
    },
    addListener: cb => listeners.add(cb),
    removeListener: cb => listeners.delete(cb),
    dispatchEvent: () => false,
    fire(matches: boolean) {
      mql.matches = matches;
      listeners.forEach(cb =>
        cb({ matches, media: mql.media } as MediaQueryListEvent),
      );
    },
  };
  window.matchMedia = vi.fn(() => mql);
  return mql;
}

function Probe() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setTheme('light')}>set light</button>
      <button onClick={() => setTheme('dark')}>set dark</button>
    </div>
  );
}

function renderProbe() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
}

function theme() {
  return document.querySelector('[data-testid="theme"]')!.textContent;
}

function resolved() {
  return document.querySelector('[data-testid="resolved"]')!.textContent;
}

function htmlHasDark() {
  return document.documentElement.classList.contains('dark');
}

beforeEach(() => {
  document.documentElement.classList.remove('dark');
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.classList.remove('dark');
});

describe('ThemeProvider default', () => {
  it('defaults to system and resolves dark when OS prefers dark', () => {
    installMatchMedia(true);
    renderProbe();
    expect(theme()).toBe('system');
    expect(resolved()).toBe('dark');
    expect(htmlHasDark()).toBe(true);
  });

  it('resolves light when OS prefers light', () => {
    installMatchMedia(false);
    renderProbe();
    expect(theme()).toBe('system');
    expect(resolved()).toBe('light');
    expect(htmlHasDark()).toBe(false);
  });

  it('honors a persisted explicit theme over the system default', () => {
    localStorage.setItem('kapwa-theme', 'light');
    installMatchMedia(true);
    renderProbe();
    expect(theme()).toBe('light');
    expect(resolved()).toBe('light');
    expect(htmlHasDark()).toBe(false);
  });

  it('follows OS preference changes while in system mode', () => {
    const mql = installMatchMedia(false);
    renderProbe();
    expect(resolved()).toBe('light');

    act(() => mql.fire(true));
    expect(resolved()).toBe('dark');
    expect(htmlHasDark()).toBe(true);

    act(() => mql.fire(false));
    expect(resolved()).toBe('light');
    expect(htmlHasDark()).toBe(false);
  });
});

describe('ThemeProvider setTheme', () => {
  it('applies and persists an explicit theme', () => {
    installMatchMedia(true);
    const { getByText } = renderProbe();
    act(() => getByText('set light').click());
    expect(theme()).toBe('light');
    expect(htmlHasDark()).toBe(false);
    expect(localStorage.getItem('kapwa-theme')).toBe('light');
  });

  it('applies dark class when set to dark under a light OS', () => {
    installMatchMedia(false);
    const { getByText } = renderProbe();
    act(() => getByText('set dark').click());
    expect(theme()).toBe('dark');
    expect(htmlHasDark()).toBe(true);
    expect(localStorage.getItem('kapwa-theme')).toBe('dark');
  });
});
