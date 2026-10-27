import * as path from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'

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
    // Node 25+ ships Web Storage on by default: `localStorage` becomes a
    // global getter that yields undefined without --localstorage-file, and
    // `sessionStorage` becomes Node's own in-memory store. Vitest only copies
    // happy-dom window keys that are not already on the global, so without
    // this flag the tests get Node's storage instead of happy-dom's and the
    // zustand persist stores throw on setItem. No-op on Node 24.
    execArgv: ['--no-experimental-webstorage'],
    coverage: {
      provider: 'v8',
      // `lcov` (coverage/lcov.info) is what Codecov ingests in CI.
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
    include: [
      'packages/*/src/**/*.test.ts',
      'packages/*/src/**/*.test.tsx',
      'e2e/mocks/**/*.test.ts',
    ],
    // `*.integration.test.ts` matches the include glob above, so without this
    // the unit suite silently swallows the whole integration layer. It has its
    // own runner: `pnpm test:integration`.
    exclude: [
      ...configDefaults.exclude,
      'packages/*/src/**/*.integration.test.ts',
    ],
  },
})
