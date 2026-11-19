import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  plugins: [react({ jsxRuntime: 'automatic' })],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        '@zerodev/react-ui',
        '@zerodev/smart-routing-address',
        // Match `viem` and every subpath (`viem/chains`, `viem/utils`, etc.)
        // — otherwise Rollup inlines `viem/chains`, ballooning the bundle.
        /^viem(\/|$)/,
        /^zod(\/|$)/,
        'uqr',
      ],
    },
    sourcemap: true,
    emptyOutDir: false,
  },
})
