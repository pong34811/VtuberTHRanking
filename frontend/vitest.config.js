import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const absoluteGlob = pattern => path.resolve(import.meta.dirname, pattern).replaceAll('\\', '/');
const srcDir = path.resolve(import.meta.dirname, './src');

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/setup/node.js'],
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      allowExternal: true,
      include: [
        absoluteGlob('server/**/*.js'),
        absoluteGlob('src/**/*.{js,jsx}'),
        absoluteGlob('../worker/**/*.js'),
      ],
      exclude: [absoluteGlob('src/main.jsx'), absoluteGlob('src/components/ui/**')],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/**/*.{test,spec}.{js,jsx}'],
          exclude: ['tests/unit/components/**/*.{test,spec}.{js,jsx}'],
        },
      },
      {
        extends: true,
        esbuild: {
          jsx: 'automatic',
        },
        plugins: [react({ jsxRuntime: 'automatic' })],
        resolve: {
          alias: {
            '@': srcDir,
          },
        },
        test: {
          name: 'components',
          environment: 'jsdom',
          include: ['tests/unit/components/**/*.{test,spec}.{js,jsx}'],
        },
      },
    ],
  },
});
