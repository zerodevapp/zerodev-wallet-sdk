import * as path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
  },
})
