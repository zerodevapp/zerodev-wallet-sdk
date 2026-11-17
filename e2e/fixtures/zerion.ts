/**
 * Playwright fixture for tests that need the real Zerion extension.
 */

import { rmSync } from 'node:fs'
import { type BrowserContext, test as base, type Page } from '@playwright/test'
import { TEST_WALLET } from '../helpers/wallet-credentials.js'
import {
  copyProfile,
  ensureOnboardedProfile,
  extensionUrl,
  launchWithZerion,
  unlockIfLocked,
} from '../helpers/zerion/session.js'
import { Zerion } from '../helpers/zerion/zerion.js'

interface ZerionFixtures {
  context: BrowserContext
  extensionId: string
  /** Drives the extension side of a connect or signature request. */
  zerion: Zerion
  /** The wallet's own UI, unlocked and on the home route. */
  walletPage: Page
}

interface ZerionWorkerFixtures {
  onboardedProfile: string
}

export const test = base.extend<ZerionFixtures, ZerionWorkerFixtures>({
  onboardedProfile: [
    // biome-ignore lint/correctness/noEmptyPattern: required by Playwright's fixture signature
    async ({}, use, workerInfo) => {
      const headless = workerInfo.project.use.headless ?? true
      await use(await ensureOnboardedProfile(headless))
    },
    { scope: 'worker' },
  ],

  context: async ({ onboardedProfile }, use, testInfo) => {
    const { headless, baseURL, ignoreHTTPSErrors } = testInfo.project.use

    const userDataDir = copyProfile(onboardedProfile)

    const { context } = await launchWithZerion({
      userDataDir,
      headless: headless ?? true,
      ...(baseURL && { baseURL }),
      ...(ignoreHTTPSErrors !== undefined && { ignoreHTTPSErrors }),
    })

    await use(context)

    await context.close()
    rmSync(userDataDir, { recursive: true, force: true })
  },

  extensionId: async ({ context }, use) => {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker'))
    const id = worker.url().match(/^chrome-extension:\/\/([a-p]{32})\//)?.[1]
    if (!id)
      throw new Error(`could not read an extension id from ${worker.url()}`)
    await use(id)
  },

  zerion: async ({ context, extensionId }, use) => {
    const zerion = new Zerion(context, extensionId, TEST_WALLET.password)
    // Unlocking the wallet here ensures that any subsequent requests will be
    // presented against an unlocked wallet, avoiding the issue described above.
    await zerion.unlock()
    await use(zerion)
  },

  walletPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage()
    await page.goto(extensionUrl(extensionId))
    await unlockIfLocked(page, TEST_WALLET.password)
    await use(page)
    if (!page.isClosed()) await page.close()
  },
})
