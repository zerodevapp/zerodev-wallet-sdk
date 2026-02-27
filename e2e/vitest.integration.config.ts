import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@zerodev/wallet-core': path.resolve(
        __dirname,
        '../packages/core/src/index.ts',
      ),
    },
  },
  test: {
    include: ['e2e/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
    hookTimeout: 60_000,
    pool: 'forks',
    fileParallelism: false,
  },
})
