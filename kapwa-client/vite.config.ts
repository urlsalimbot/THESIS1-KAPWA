// Vite config
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default {
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3001,
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
