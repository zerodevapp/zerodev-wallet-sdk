import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Load `.env` from repo root (see `.env.example`) into process.env. Done
// explicitly because vitest's Node test runner reads `process.env` directly
// and doesn't auto-load dotenv files.
const envPath = path.resolve(__dirname, '../.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '')
    if (process.env[key] === undefined) process.env[key] = value
  }
}

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
    include: ['e2e/integration/**/*.test.ts', 'e2e/mocks/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
    hookTimeout: 60_000,
    pool: 'forks',
    fileParallelism: false,
  },
})
