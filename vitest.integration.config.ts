import * as path from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'

// The integration layer: boundary and flow tests that span a seam but need NO
// live service. Nothing here may read a secret or open a socket — the
// live-dependency suites are `e2e/vitest.backend.config.ts` (real KMS/Turnkey)
// and `e2e/playwright.config.ts` (browser).
//
// The alias block mirrors `vitest.config.ts` on purpose: cross-package boundary
// tests import by package specifier. If a third config ever needs it, extract
// it rather than adding a third copy.
export default defineConfig({
  resolve: {
    alias: {
      '@zerodev/wallet-core': path.resolve(
        __dirname,
        'packages/core/src/index.ts',
      ),
      '@zerodev/wallet-react': path.resolve(
        __dirname,
        'packages/react/src/index.ts',
      ),
      '@zerodev/react-ui': path.resolve(
        __dirname,
        'packages/react-ui/src/index.ts',
      ),
      'react-native': 'react-native-web',
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['packages/*/src/**/*.integration.test.ts'],
    exclude: configDefaults.exclude,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage/integration',
      include: ['packages/*/src/**/*.ts', 'packages/*/src/**/*.tsx'],
      exclude: [
        'packages/*/src/**/*.test.ts',
        'packages/*/src/**/*.test.tsx',
        'packages/*/src/**/*.test-d.ts',
        'packages/*/src/**/*.bench.ts',
        'packages/*/src/**/index.ts',
        'packages/*/src/**/index.tsx',
        'packages/*/src/**/types.ts',
        'packages/*/src/**/types/**',
        'packages/*/src/**/*.stories.tsx',
        'packages/*/src/**/*.d.ts',
      ],
    },
  },
})
