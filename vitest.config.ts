import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    typecheck: { tsconfig: './tsconfig.test.json' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/scenes/**', 'src/vite-env.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'phaser': resolve(__dirname, 'tests/__mocks__/phaser.ts'),
    },
  },
});
