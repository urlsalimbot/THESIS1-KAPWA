// Vite config
import path from 'node:path';

export default {
  server: { 
    port: 3001,
    hmr: {
      overlay: false,
    },
  },
  build: { outDir: 'dist' },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      react: path.resolve(import.meta.dirname, 'node_modules/react'),
      'react-dom': path.resolve(import.meta.dirname, 'node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['src/__tests__/e2e.test.ts', 'src/__tests__/a11y/pages.test.ts'],
  },
};
