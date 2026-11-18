import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // Emit package-relative asset URLs (the StatusScreen state images) so they
  // resolve when the package is served from any subpath, not root-absolute.
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
        '@zerodev/wallet-core',
        '@zerodev/wallet-react',
        '@wagmi/core',
        '@tanstack/react-query',
        // WalletConnect's SDK is large and the host already ships it for wagmi.
        /^@walletconnect\//,
        'viem',
        'wagmi',
        /^wagmi\//,
        'zustand',
        /^zustand\//,
      ],
    },
    sourcemap: true,
    emptyOutDir: false,
  },
})
