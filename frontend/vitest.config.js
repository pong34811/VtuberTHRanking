import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/setup/node.js'],
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['server/**/*.js', 'src/**/*.{js,jsx}', '../worker/**/*.js'],
      exclude: ['src/main.jsx', 'src/components/ui/**'],
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
        test: {
          name: 'components',
          environment: 'jsdom',
          include: ['tests/unit/components/**/*.{test,spec}.{js,jsx}'],
        },
      },
    ],
  },
});
