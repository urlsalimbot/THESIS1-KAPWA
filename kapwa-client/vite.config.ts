// Vite config
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Security headers for the dev server.
 *
 * The NestJS API already sends these via helmet, but the Vite dev server is a
 * separate origin (:3001) that sends none of them — which is what an OWASP ZAP
 * scan of the dev URL reports as "CSP Header Not Set", "Missing Anti-clickjacking
 * Header" and "X-Content-Type-Options Header Missing". Applying them here keeps
 * the dev origin clean and keeps dev resembling the deployed SPA (nginx.conf
 * carries the production equivalent, where the script-src relaxations below are
 * dropped).
 *
 * CSP notes, per directive:
 *   script-src 'unsafe-inline' 'unsafe-eval' — @vitejs/plugin-react injects the
 *     React Refresh preamble as an inline module script, and HMR evaluates
 *     modules. The production build has neither, so nginx.conf uses `'self'`.
 *   connect-src — .env.development points VITE_WS_URL at http://localhost:3000,
 *     so the chat and notification sockets are cross-origin in dev. The two dev
 *     origins are enumerated rather than wildcarded so the policy stays
 *     reviewable and does not trip ZAP's wildcard-directive rule.
 *   style-src 'unsafe-inline' — Tailwind/Radix apply inline styles.
 *   fonts.googleapis.com / fonts.gstatic.com — index.css imports Geist and
 *     Source Sans 3 from Google Fonts at runtime.
 *   frame-ancestors 'none' + X-Frame-Options — the anti-clickjacking pair ZAP
 *     looks for.
 */
const CSP_DEV = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Dev keeps 'unsafe-inline' for styles, and production does NOT — the
  // asymmetry is forced, not a shortcut. Vite serves CSS by injecting it as a
  // <style> element at runtime (the app's own stylesheet included), and one of
  // those injected styles is regenerated as HMR runs, so no fixed hash can
  // cover it. The production build ships CSS as a fingerprinted file instead,
  // and nginx pins the only two injected sheets (sonner, Radix ScrollArea) by
  // SHA-256 — see nginx-security-headers.conf.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' http://localhost:3000 ws://localhost:3000 http://localhost:3001 ws://localhost:3001",
  "worker-src 'self' blob:",
].join('; ');

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP_DEV,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  // Site isolation (ZAP 90004 / CWE-693). COEP: require-corp makes the page
  // refuse cross-origin subresources that do not grant permission; the only
  // cross-origin resources the SPA loads are the two Google Fonts hosts, which
  // send `Cross-Origin-Resource-Policy: cross-origin`. Same-origin assets and
  // blob: URLs are unaffected, and WebSockets are out of COEP's scope.
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

export default {
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3001,
    headers: SECURITY_HEADERS,
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
    hmr: {
      overlay: false,
    },
  },
  build: { outDir: 'dist' },
  optimizeDeps: {
    include: ['react-dom', 'react-dom/client'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['src/__tests__/e2e.test.ts', 'src/__tests__/a11y/pages.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/{api,api-error,auth-context,offline-queue,secure-storage}.{ts,tsx}',
      ],
      exclude: ['**/*.test.{ts,tsx}', '**/types.ts', '**/index.ts'],
      thresholds: {
        perFile: true,
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
};
