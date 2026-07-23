/**
 * Manual-testing runner (scenario 1). Starts the Mockttp proxy with a chosen
 * preset, starts the demo app, and launches a headed Chromium routed through
 * the proxy — so you drive the real app/SDK by hand against mocked responses.
 *
 * Run under a plain-Node TS loader (tsx), NOT vite-node: mockttp's CA
 * generation trips @peculiar's schema registry under Vite's resolver.
 *
 *   pnpm mock:dev                     # passthrough only (no mocks)
 *   pnpm mock:dev --preset example    # apply a named preset
 */
import { type ChildProcess, spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { presets } from './presets/index.js'
import {
  applyMocks,
  DEFAULT_MOCK_PORT,
  startMockServer,
  stopMockServer,
} from './server.js'

const APP_URL = 'http://localhost:3000'

function parsePreset(): string | undefined {
  const i = process.argv.indexOf('--preset')
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const presetName = parsePreset()
  if (presetName && !(presetName in presets)) {
    console.error(
      `Unknown preset "${presetName}". Available: ${Object.keys(presets).join(', ')}`,
    )
    process.exit(1)
  }
  const mocks = presetName ? presets[presetName as keyof typeof presets] : []

  const server = await startMockServer(DEFAULT_MOCK_PORT)
  await applyMocks(server, mocks, 'passthrough')
  console.log(
    `[mock] proxy on :${DEFAULT_MOCK_PORT}${
      presetName ? ` with preset "${presetName}"` : ' (passthrough only)'
    }`,
  )

  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = path.resolve(__dirname, '../..')
  const app: ChildProcess = spawn(
    'pnpm',
    ['--filter', '@zerodev/signer-demo', 'dev'],
    { cwd: repoRoot, stdio: 'inherit', shell: true },
  )

  const browser = await chromium.launch({
    headless: false,
    proxy: {
      server: `http://localhost:${DEFAULT_MOCK_PORT}`,
      bypass: 'localhost,127.0.0.1',
    },
  })
  const context = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await context.newPage()

  // The app may still be starting; retry until it responds.
  for (let i = 0; i < 30; i++) {
    try {
      await page.goto(APP_URL, { waitUntil: 'load', timeout: 2000 })
      break
    } catch {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  console.log(`[mock] browser open at ${APP_URL}. Ctrl-C to stop.`)

  const shutdown = async () => {
    await browser.close().catch(() => {})
    app.kill()
    await stopMockServer(server).catch(() => {})
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
