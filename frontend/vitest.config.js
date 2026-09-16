import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,jsx}'],
    environmentMatchGlobs: [['tests/unit/components/**', 'jsdom']],
    setupFiles: ['./tests/setup/node.js'],
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['server/**/*.js', 'src/**/*.{js,jsx}', '../worker/**/*.js'],
      exclude: ['src/main.jsx', 'src/components/ui/**'],
    },
  },
});
