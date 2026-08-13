import '@testing-library/jest-dom/vitest';
import 'vitest-axe/extend-expect';
import * as axeMatchers from 'vitest-axe/matchers';
import { expect, vi } from 'vitest';

expect.extend(axeMatchers);

// jsdom lacks pointer capture APIs used by Radix (Select/Dropdown) on pointer events
if (typeof Element !== 'undefined' && !Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

// jsdom lacks scrollIntoView; Radix Select calls it when opening
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom lacks matchMedia; theme-context uses it to resolve the system theme
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// jsdom lacks window.scrollTo; Radix and app shell call it on navigation
if (typeof window !== 'undefined' && typeof window.scrollTo !== 'function') {
  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    configurable: true,
    value: vi.fn(),
  });
}

// jsdom lacks canvas 2d context; chart libs call getContext during render
if (typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.getContext !== 'function') {
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    const ctx = {
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      putImageData: vi.fn(),
      createImageData: () => ({ data: new Uint8ClampedArray(4) }),
      setTransform: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      fillText: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      measureText: () => ({ width: 0 }),
      transform: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
    };
    return ctx as unknown as CanvasRenderingContext2D;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

// Mock localStorage for all environments (Node 26 + jsdom compat)
const store: Record<string, string> = {};
const mockStorage: Storage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  get length() { return Object.keys(store).length; },
  key: (index: number) => Object.keys(store)[index] ?? null,
};
Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  writable: true,
  configurable: true,
});

// Mock window.localStorage too (for code using window prefix)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
}

// Mock crypto for test environment
if (typeof crypto === 'undefined' || !crypto.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2),
      getRandomValues: (arr: Uint8Array) => { for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256); return arr; },
      subtle: {
        importKey: vi.fn(),
        exportKey: vi.fn(),
        sign: vi.fn(),
        verify: vi.fn(),
        encrypt: vi.fn(),
        decrypt: vi.fn(),
        deriveKey: vi.fn(),
        generateKey: vi.fn(),
      },
    },
    writable: true,
    configurable: true,
  });
}

beforeAll(() => {
  // Navigator stub
  vi.stubGlobal('navigator', {
    onLine: true,
    geolocation: { getCurrentPosition: vi.fn() },
  });
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
