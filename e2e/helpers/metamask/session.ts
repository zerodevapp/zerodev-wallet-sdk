/**
 * Launching Chromium with the real MetaMask, and the profile cache that keeps
 * onboarding to once per pinned version.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { type BrowserContext, chromium } from '@playwright/test'
import { mnemonicToAccount } from 'viem/accounts'
import { TEST_WALLET } from '../wallet-credentials.js'
import { ensureMetaMaskExtension, PROFILE_SNAPSHOT_DIR } from './extension.js'
import { onboardWithRecoveryPhrase } from './onboard.js'
import { unlockIfLocked } from './unlock.js'

export { unlockIfLocked }

/** Chrome takes its time bringing an MV3 service worker up under load. */
const SERVICE_WORKER_TIMEOUT_MS = 60_000

export interface MetaMaskLaunch {
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
 * Launches a persistent context with MetaMask loaded and waits until the
 * extension is actually running.
 */
export async function launchWithMetaMask({
  userDataDir,
  headless,
  baseURL,
  ignoreHTTPSErrors,
}: LaunchOptions): Promise<MetaMaskLaunch> {
  const extensionDir = await ensureMetaMaskExtension()

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
  return `chrome-extension://${extensionId}/home.html${hash}`
}

/** How long MetaMask gets to write the finished onboarding out to disk. */
const PERSIST_TIMEOUT_MS = 60_000

/** Records which account the cached snapshot was onboarded with. */
const PROFILE_STAMP_FILE = `${PROFILE_SNAPSHOT_DIR}.json`

const readProfileStamp = (): { account: string } | null => {
  if (!existsSync(PROFILE_STAMP_FILE)) return null
  try {
    return JSON.parse(readFileSync(PROFILE_STAMP_FILE, 'utf8'))
  } catch {
    return null
  }
}

/**
 * Waits until the finished onboarding is actually on disk.
 */
async function waitForPersistedOnboarding(
  userDataDir: string,
  extensionId: string,
): Promise<boolean> {
  const storageDir = path.join(
    userDataDir,
    'Default',
    'Local Extension Settings',
    extensionId,
  )
  const deadline = Date.now() + PERSIST_TIMEOUT_MS

  while (Date.now() < deadline) {
    if (existsSync(storageDir)) {
      const written = readdirSync(storageDir).some((file) => {
        try {
          return readFileSync(path.join(storageDir, file)).includes(
            '"completedOnboarding":true',
          )
        } catch {
          return false
        }
      })
      if (written) return true
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
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

  if (existsSync(PROFILE_SNAPSHOT_DIR)) {
    if (readProfileStamp()?.account === account) return PROFILE_SNAPSHOT_DIR
    rmSync(PROFILE_SNAPSHOT_DIR, { recursive: true, force: true })
  }
  const scratch = mkdtempSync(path.join(tmpdir(), 'mm-onboarding-'))
  const staging = `${PROFILE_SNAPSHOT_DIR}.partial`

  try {
    const { context, extensionId } = await launchWithMetaMask({
      userDataDir: scratch,
      headless,
    })

    const page = await context.newPage()
    await page.goto(extensionUrl(extensionId, '#onboarding/welcome'))
    await onboardWithRecoveryPhrase(page, credentials)

    const persisted = await waitForPersistedOnboarding(scratch, extensionId)

    // Closing also flushes. Snapshotting a live profile captures a half-written
    // leveldb, so the copy only happens once the browser is gone.
    await context.close()

    if (!persisted) {
      throw new Error(
        'MetaMask onboarding completed but never persisted `completedOnboarding` to disk. ' +
          'Snapshotting now would cache a profile that boots back to the welcome screen.',
      )
    }

    // Build beside the destination and promote only after it has been proven,
    // so an interrupted or bad run cannot leave something later runs trust.
    rmSync(staging, { recursive: true, force: true })
    mkdirSync(path.dirname(PROFILE_SNAPSHOT_DIR), { recursive: true })
    cpSync(scratch, staging, { recursive: true })

    await assertProfileIsOnboarded(staging, headless, credentials.password)

    rmSync(PROFILE_SNAPSHOT_DIR, { recursive: true, force: true })
    cpSync(staging, PROFILE_SNAPSHOT_DIR, { recursive: true })
    writeFileSync(PROFILE_STAMP_FILE, JSON.stringify({ account }))

    return PROFILE_SNAPSHOT_DIR
  } finally {
    rmSync(scratch, { recursive: true, force: true })
    rmSync(staging, { recursive: true, force: true })
  }
}

/**
 * Launches a candidate snapshot and fails unless it comes up as a real wallet.
 */
async function assertProfileIsOnboarded(
  profileDir: string,
  headless: boolean,
  password: string,
): Promise<void> {
  const probeDir = mkdtempSync(path.join(tmpdir(), 'mm-verify-'))
  cpSync(profileDir, probeDir, { recursive: true })

  try {
    const { context, extensionId } = await launchWithMetaMask({
      userDataDir: probeDir,
      headless,
    })
    try {
      const page = await context.newPage()
      await page.goto(extensionUrl(extensionId))
      await unlockIfLocked(page, password)

      const onboarded = await page
        .getByTestId('account-menu-icon')
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
  const dir = mkdtempSync(path.join(tmpdir(), 'mm-profile-'))
  cpSync(snapshotDir, dir, { recursive: true })
  return dir
}
