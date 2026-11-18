/**
 * Launching Chromium with the real Zerion, and the profile cache that keeps
 * onboarding to once per pinned version.
 */

import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { type BrowserContext, chromium, type Page } from '@playwright/test'
import { mnemonicToAccount } from 'viem/accounts'
import { zerionCheckActivity } from '../../mocks/definitions/zerion/checkActivity.js'
import { routeMocks } from '../../mocks/routeMocks.js'
import { withWalletCacheLock } from '../e2e-cache.js'
import { TEST_WALLET } from '../wallet-credentials.js'
import {
  CACHE_ROOT,
  EXTENSION_DIR,
  ensureZerionExtension,
  PROFILE_SNAPSHOT_DIR,
} from './extension.js'
import { onboardWithRecoveryPhrase } from './onboard.js'
import { unlockIfLocked } from './unlock.js'

export { unlockIfLocked }

/** Chrome takes its time bringing an MV3 service worker up under load. */
const SERVICE_WORKER_TIMEOUT_MS = 60_000

/** How long Zerion gets to open its own onboarding tab. */
const ONBOARDING_TAB_TIMEOUT_MS = 30_000

export interface ZerionLaunch {
  context: BrowserContext
  /** Derived at runtime — it is a hash of the unpack path, not a constant. */
  extensionId: string
}

export interface LaunchOptions {
  userDataDir: string
  headless: boolean
  baseURL?: string
  ignoreHTTPSErrors?: boolean
}

/**
 * Launches a persistent context with Zerion loaded and waits until the
 * extension is actually running.
 */
export async function launchWithZerion({
  userDataDir,
  headless,
  baseURL,
  ignoreHTTPSErrors,
}: LaunchOptions): Promise<ZerionLaunch> {
  const extensionDir = await ensureZerionExtension()

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless,
    ...(baseURL && { baseURL }),
    ignoreHTTPSErrors: ignoreHTTPSErrors ?? false,
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
    ],
  })

  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker', {
      timeout: SERVICE_WORKER_TIMEOUT_MS,
    }))

  const extensionId = worker
    .url()
    .match(/^chrome-extension:\/\/([a-p]{32})\//)?.[1]
  if (!extensionId) {
    throw new Error(`could not read an extension id from ${worker.url()}`)
  }

  return { context, extensionId }
}

/** A page on the extension's own origin, which is where the wallet UI lives. */
export function extensionUrl(extensionId: string, hash = '#/'): string {
  return `chrome-extension://${extensionId}/ui/popup.html${hash}`
}

/** The tab Zerion opens itself on a fresh profile. */
export function onboardingUrl(extensionId: string): string {
  return `chrome-extension://${extensionId}/ui/popup.html?windowType=tab&appMode=onboarding#/onboarding`
}

/**
 * Returns the onboarding tab Zerion opened, or opens one if it never arrived.
 */
async function openOnboardingTab(
  context: BrowserContext,
  extensionId: string,
): Promise<Page> {
  const isOnboarding = (page: Page) => page.url().includes('onboarding')

  const arrived = new Promise<Page>((resolve) => {
    context.on('page', (page) => {
      if (isOnboarding(page)) resolve(page)
    })
  })
  const existing = context.pages().find(isOnboarding)
  if (existing) return existing

  const timedOut = Symbol('timeout')
  const page = await Promise.race([
    arrived,
    new Promise<typeof timedOut>((resolve) =>
      setTimeout(() => resolve(timedOut), ONBOARDING_TAB_TIMEOUT_MS),
    ),
  ])
  if (page !== timedOut) return page

  const fallback = await context.newPage()
  await fallback.goto(onboardingUrl(extensionId))
  return fallback
}

/** Records which credentials the cached snapshot was onboarded with. */
const PROFILE_STAMP_FILE = `${PROFILE_SNAPSHOT_DIR}.json`

const credentialsFingerprint = (): string =>
  createHash('sha256')
    .update(`${TEST_WALLET.secretRecoveryPhrase}\n${TEST_WALLET.password}`)
    .digest('hex')

/**
 * Where the extension was unpacked when the snapshot was built.
 */
const extensionPath = (): string => path.resolve(EXTENSION_DIR)

const readProfileStamp = (): {
  account: string
  credentials?: string
  extensionPath?: string
} | null => {
  if (!existsSync(PROFILE_STAMP_FILE)) return null
  try {
    return JSON.parse(readFileSync(PROFILE_STAMP_FILE, 'utf8'))
  } catch {
    return null
  }
}

/**
 * Returns the onboarded snapshot, building it on first use.
 */
export async function ensureOnboardedProfile(
  headless: boolean,
): Promise<string> {
  const credentials = TEST_WALLET

  // The account the phrase derives, stored beside the snapshot so editing
  // TEST_WALLET re-onboards instead of silently reusing the previous wallet.
  const account = mnemonicToAccount(credentials.secretRecoveryPhrase).address
  const fingerprint = credentialsFingerprint()

  const ready = (): boolean => {
    if (!existsSync(PROFILE_SNAPSHOT_DIR)) return false
    const stamp = readProfileStamp()
    return (
      stamp?.credentials === fingerprint &&
      stamp.extensionPath === extensionPath()
    )
  }

  if (ready()) {
    await ensureZerionExtension()
    return PROFILE_SNAPSHOT_DIR
  }

  // Held across the whole onboarding, not just the copy: every worker calls
  // this (the fixture is worker-scoped), and an onboarding is minutes of work
  // that must happen once. The lock is reentrant, so the nested
  // `ensureZerionExtension` below does not wait on this one.
  return withWalletCacheLock(CACHE_ROOT, async () => {
    await ensureZerionExtension()

    // Re-checked under the lock: whoever waited here is normally looking at a
    // profile someone else just onboarded.
    if (ready()) return PROFILE_SNAPSHOT_DIR
    rmSync(PROFILE_SNAPSHOT_DIR, { recursive: true, force: true })

    return buildOnboardedProfile(headless, credentials, account, fingerprint)
  })
}

async function buildOnboardedProfile(
  headless: boolean,
  credentials: typeof TEST_WALLET,
  account: string,
  fingerprint: string,
): Promise<string> {
  const scratch = mkdtempSync(path.join(tmpdir(), 'zerion-onboarding-'))
  const staging = `${PROFILE_SNAPSHOT_DIR}.partial`

  try {
    const { context, extensionId } = await launchWithZerion({
      userDataDir: scratch,
      headless,
    })

    try {
      const page = await openOnboardingTab(context, extensionId)
      const mocked = await routeMocks(page, zerionCheckActivity)
      await onboardWithRecoveryPhrase(page, credentials)
      if (mocked.hits() === 0) {
        throw new Error(
          'onboarding completed without the check-activity mock serving, so ' +
            'it reached the real Zerion API — the mock no longer matches.',
        )
      }
    } finally {
      // Closing also flushes. Snapshotting a live profile captures a
      // half-written leveldb, so the copy only happens once the browser is
      // gone. On a failed onboard this still has to run, or the outer
      // `finally` deletes `scratch` out from under a live Chromium that then
      // survives to worker shutdown.
      await context.close()
    }

    // Build beside the destination and promote only after it has been proven,
    // so an interrupted or bad run cannot leave something later runs trust.
    rmSync(staging, { recursive: true, force: true })
    mkdirSync(path.dirname(PROFILE_SNAPSHOT_DIR), { recursive: true })
    cpSync(scratch, staging, { recursive: true })

    await assertProfileIsOnboarded(staging, headless, credentials.password)

    rmSync(PROFILE_SNAPSHOT_DIR, { recursive: true, force: true })
    cpSync(staging, PROFILE_SNAPSHOT_DIR, { recursive: true })
    writeFileSync(
      PROFILE_STAMP_FILE,
      JSON.stringify({
        account,
        credentials: fingerprint,
        extensionPath: extensionPath(),
      }),
    )

    return PROFILE_SNAPSHOT_DIR
  } finally {
    rmSync(scratch, { recursive: true, force: true })
    rmSync(staging, { recursive: true, force: true })
  }
}

/**
 * Asserts that a candidate snapshot is fully onboarded.
 */
async function assertProfileIsOnboarded(
  profileDir: string,
  headless: boolean,
  password: string,
): Promise<void> {
  const probeDir = mkdtempSync(path.join(tmpdir(), 'zerion-verify-'))
  cpSync(profileDir, probeDir, { recursive: true })

  try {
    const { context, extensionId } = await launchWithZerion({
      userDataDir: probeDir,
      headless,
    })
    try {
      const page = await context.newPage()
      await page.goto(extensionUrl(extensionId))
      await unlockIfLocked(page, password)

      const onboarded = await page
        .getByRole('button', { name: /Copy Address/i })
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => true)
        .catch(() => false)

      if (!onboarded) {
        throw new Error(
          `the onboarded snapshot does not reopen as a wallet — it landed on ${page.url()}`,
        )
      }
    } finally {
      await context.close()
    }
  } finally {
    rmSync(probeDir, { recursive: true, force: true })
  }
}

/** A disposable copy of the onboarded snapshot for one test to dirty. */
export function copyProfile(snapshotDir = PROFILE_SNAPSHOT_DIR): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'zerion-profile-'))
  cpSync(snapshotDir, dir, { recursive: true })
  return dir
}
