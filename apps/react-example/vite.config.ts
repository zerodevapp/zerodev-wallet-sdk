import * as path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import svgr from 'vite-plugin-svgr'

export default defineConfig({
  plugins: [
    react(),
    svgr({ svgrOptions: { exportType: 'default' } }),
    tailwindcss(),
    nodePolyfills({ include: ['buffer'], globals: { Buffer: true } }),
  ],
  resolve: {
    alias: {
      // Point to react-kit source so changes are picked up instantly during dev
      '@zerodev/wallet-react-kit': path.resolve(
        __dirname,
        '../../packages/react-kit/src/index.ts',
      ),
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'https://kms.staging.zerodev.app',
        changeOrigin: true,
      },
    },
  },
})
