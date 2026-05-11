import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'

export default defineConfig({
  plugins: [
    react({ jsxRuntime: 'automatic' }),
    svgr({ svgrOptions: { exportType: 'default' } }),
  ],
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
        '@zerodev/wallet-core',
        '@zerodev/wallet-react',
        '@wagmi/core',
        '@tanstack/react-query',
        'viem',
        'wagmi',
        'zustand',
        /^zustand\//,
      ],
    },
    sourcemap: true,
    emptyOutDir: false,
  },
})
