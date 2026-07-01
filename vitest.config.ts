import * as path from 'node:path'
import { defineConfig } from 'vitest/config'

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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
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
      ],
    },
    include: ['packages/*/src/**/*.test.ts', 'packages/*/src/**/*.test.tsx'],
  },
})
