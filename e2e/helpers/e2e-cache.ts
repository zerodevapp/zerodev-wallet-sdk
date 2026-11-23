/**
 * Shared on-disk cache for browser e2e fixtures with costly setup.
 *
 * `e2e/.cache/` is the root. Each wallet gets its own directory there. A future
 * extension should add its own sibling directory. CI restores the whole tree with
 * one `actions/cache` step.
 *
 * Everything in the cache is derived and gitignored. Do not commit it. Chrome
 * derives an unpacked extension ID from its absolute path, so a profile built
 * in one checkout does not work in another. The profiles also contain encrypted
 * vaults.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** `<repo>/e2e/.cache`, the directory CI restores. */
export const E2E_CACHE_ROOT = path.resolve(__dirname, '../.cache')

/**
 * The cache directory belonging to one wallet.
 */
export function walletCacheDir(wallet: string): string {
  return path.join(E2E_CACHE_ROOT, wallet)
}

/** A build holds the lock across a download, an unzip and an onboarding. */
const LOCK_WAIT_MS = 10 * 60_000

/** Short enough that a queued worker starts promptly, long enough to not spin. */
const LOCK_POLL_MS = 200

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Lock directories held by the *current async call chain*, not by the process.
 */
const heldLocks = new AsyncLocalStorage<ReadonlySet<string>>()

/**
 * `mkdir` is the test-and-set: it fails if the directory is there, so exactly
 * one caller creates it. The owner file is what lets a waiter tell a live
 * holder from a dead one.
 */
function tryAcquire(lockDir: string): boolean {
  try {
    mkdirSync(lockDir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false
    throw error
  }
  writeFileSync(
    path.join(lockDir, 'owner.json'),
    JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
  )
  return true
}

/**
 * True when the lock belongs to a process that no longer exists.
 */
function isAbandoned(lockDir: string): boolean {
  try {
    const { pid } = JSON.parse(
      readFileSync(path.join(lockDir, 'owner.json'), 'utf8'),
    ) as { pid: number }
    process.kill(pid, 0)
    return false
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return true
    // EPERM means the pid exists and belongs to someone else, so it is alive.
    if ((error as NodeJS.ErrnoException).code === 'EPERM') return false
    return true
  }
}

/**
 * Runs `build` with an exclusive on-disk lock over one wallet's cache
 * directory.
 */
export async function withWalletCacheLock<T>(
  cacheRoot: string,
  build: () => Promise<T>,
): Promise<T> {
  mkdirSync(cacheRoot, { recursive: true })
  const lockDir = path.join(cacheRoot, '.lock')

  // Reentrant, because the builders nest: a profile build takes the lock and
  // then calls the extension build, which takes the same one. Without this the
  // nested call would wait on a lock its own caller holds, until the timeout.
  const outer = heldLocks.getStore()
  if (outer?.has(lockDir)) return build()

  const deadline = Date.now() + LOCK_WAIT_MS
  while (!tryAcquire(lockDir)) {
    if (existsSync(lockDir) && isAbandoned(lockDir)) {
      rmSync(lockDir, { recursive: true, force: true })
      continue
    }
    if (Date.now() > deadline) {
      throw new Error(
        `waited ${Math.round(LOCK_WAIT_MS / 60_000)} minutes for the wallet cache lock at ` +
          `${lockDir}, which is still held by a live process. If nothing is ` +
          'building, delete that directory.',
      )
    }
    await sleep(LOCK_POLL_MS)
  }

  const release = (): void => {
    rmSync(lockDir, { recursive: true, force: true })
  }
  process.once('exit', release)

  const nowHeld = new Set(outer ?? []).add(lockDir)
  try {
    return await heldLocks.run(nowHeld, build)
  } finally {
    release()
    process.off('exit', release)
  }
}
