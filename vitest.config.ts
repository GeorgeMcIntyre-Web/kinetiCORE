import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/',
        'dist/',
        'tests/',
      ],
      include: ['src/**/*.{ts,tsx}'],
    },
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'tests/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      // Exclude Playwright-specific test directories
      'tests/visual/**',
      'tests/performance/**/*.spec.ts',
      'tests/e2e/**/*.spec.ts', // All E2E tests use Playwright, not Vitest
      // Temporarily exclude tests with import resolution errors (needs fixing)
      // These have "No test suite found" errors due to Babylon/WebGL deps in happy-dom
      // Root cause: happy-dom doesn't support WebGL/Canvas APIs needed by Babylon.js
      // Solution: Migrate these tests to use jsdom or run in a real browser (Playwright)
      'src/core/typeGuards.test.ts',
      'src/core/__tests__/**',
      'src/kinematics/__tests__/**',
      'src/kinematics/utils/__tests__/**',
      'src/physics/__tests__/**',
      'src/manipulation/__tests__/**',
      'src/manipulation/snap/**/*.spec.ts',
      'src/manipulation/snap/scoring.test.ts',
      'src/ros2/**/*.test.ts',
      'src/routing/**/*.test.ts',
      'src/__tests__/buttons/**',
      'src/__tests__/smart-routing/**',
      'src/__tests__/integration/AssetLoadingWorkflow.test.ts',
      'src/__tests__/integration/ButtonIntegration.test.tsx',
      'tests/domain/tooling/**',
      'tests/babylon/**',
      'tests/gold/**',
      'tests/io/**',
      'tests/kinematics/**',
      'tests/pointCloud/**',
      'tests/routing/**',
      'tests/scene/**',
      'tests/sceneAnalysis/**',
      'tests/ui/**',
      'tests/performance/regression.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
