import * as path from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * In-process integration tests — any file named `*.integration.test.ts`
 * under a package's `src` directory (see `include` below).
 *
 * These compose several real units together — connector + store + provider,
 * or wallet core + storage + session lifecycle — with only the KMS boundary
 * supplied as a test double. No network, no staging dependency, so they run
 * in milliseconds and are deterministic.
 *
 * Distinct from the CONTRACT suite (`e2e/vitest.contract.config.ts`), which
 * talks to a live KMS and verifies the wire contract — stamping, JCS
 * canonicalization, HPKE. Same "many units" scope, opposite dependency
 * profile, so they get separate configs and separate coverage.
 *
 * Environment and aliases mirror the unit config; only `include` differs.
 */
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
    include: [
      'packages/*/src/**/*.integration.test.ts',
      'packages/*/src/**/*.integration.test.tsx',
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage/integration',
      reporter: ['text', 'html', 'lcov'],
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
