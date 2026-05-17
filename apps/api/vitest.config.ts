import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    root: './src',
    environment: 'node',
    coverage: {
      provider: 'v8',
      reportsDirectory: '../coverage',
      include: ['**/*.ts'],
      exclude: ['**/*.spec.ts', '**/main.ts'],
    },
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
