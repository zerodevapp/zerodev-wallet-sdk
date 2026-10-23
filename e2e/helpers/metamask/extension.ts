/**
 * Acquires the real MetaMask Chrome build for the browser e2e suite.
 *
 * The signed release zip, verified against the release's own `SHA256SUMS`, so
 * the suite drives the same bytes users run.
 *
 * **The unpack path is stable and must stay that way.** The release manifest
 * carries no `key`, so Chrome derives the extension id by hashing the absolute
 * path of an unpacked extension. A version-keyed directory would
 * therefore hand every upgrade a new id, orphaning the onboarded profile's
 * encrypted vault. One path, and a version stamp beside it that wipes
 * the extension and the profile together.
 *
 * The pinned version lives in `wallet-versions.ts` rather than here, because CI
 * keys its cache restore on a hash of that file and it should not churn every
 * time this one is edited.
 */

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import * as path from 'node:path'
import { promisify } from 'node:util'
import { walletCacheDir } from '../e2e-cache.js'
import { METAMASK_VERSION } from '../wallet-versions.js'

const execFileAsync = promisify(execFile)

const RELEASE_BASE =
  'https://github.com/MetaMask/metamask-extension/releases/download'

/** MetaMask's own directory under the shared `e2e/.cache` root. */
export const CACHE_ROOT = walletCacheDir('metamask')

/** Stable by contract — the extension id is a hash of this path. */
export const EXTENSION_DIR = path.join(CACHE_ROOT, 'extension')

/** The onboarded user-data-dir every test copies from. */
export const PROFILE_SNAPSHOT_DIR = path.join(CACHE_ROOT, 'profile')

const DOWNLOAD_DIR = path.join(CACHE_ROOT, 'download')
const STAMP_FILE = path.join(CACHE_ROOT, 'installed.json')

interface Stamp {
  version: string
}

const readStamp = (): Stamp | null => {
  if (!existsSync(STAMP_FILE)) return null
  try {
    return JSON.parse(readFileSync(STAMP_FILE, 'utf8')) as Stamp
  } catch {
    // A half-written stamp means an interrupted install. Treat it as absent so
    // the next run rebuilds rather than trusting a directory nobody finished.
    return null
  }
}

async function download(url: string, to: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `GET ${url} failed: ${response.status} ${response.statusText}`,
    )
  }
  writeFileSync(to, Buffer.from(await response.arrayBuffer()))
}

/**
 * Verifies the zip against the release's `SHA256SUMS`.
 *
 * Fetched fresh rather than hardcoded next to the version: a checked-in digest
 * that nobody re-derives on a bump is a digest that gets copied forward
 * unchanged, which is the same as not checking.
 */
async function verifyDigest(zipPath: string, zipName: string): Promise<void> {
  const sumsUrl = `${RELEASE_BASE}/v${METAMASK_VERSION}/SHA256SUMS`
  const response = await fetch(sumsUrl)
  if (!response.ok) {
    throw new Error(`GET ${sumsUrl} failed: ${response.status}`)
  }
  const sums = await response.text()

  const line = sums.split('\n').find((l) => l.trim().endsWith(zipName))
  if (!line) {
    throw new Error(
      `${zipName} has no entry in SHA256SUMS for v${METAMASK_VERSION}`,
    )
  }
  const expected = line.trim().split(/\s+/)[0]

  const actual = createHash('sha256')
    .update(readFileSync(zipPath))
    .digest('hex')
  if (actual !== expected) {
    // Delete it. Leaving a bad zip cached turns one bad download into a
    // permanently red suite that a re-run cannot clear.
    rmSync(zipPath, { force: true })
    throw new Error(
      `MetaMask ${METAMASK_VERSION} digest mismatch\n  expected ${expected}\n  actual   ${actual}`,
    )
  }
}

/**
 * Downloads, verifies and unpacks MetaMask if the cache does not already hold
 * the pinned version. Returns the directory to hand to `--load-extension`.
 *
 * A version change wipes the onboarded profile too, because MetaMask runs state
 * migrations on load and a profile written by another build is not a starting
 * state anybody chose.
 */
export async function ensureMetaMaskExtension(): Promise<string> {
  const stamp = readStamp()
  if (stamp?.version === METAMASK_VERSION && existsSync(EXTENSION_DIR)) {
    return EXTENSION_DIR
  }

  rmSync(EXTENSION_DIR, { recursive: true, force: true })
  rmSync(PROFILE_SNAPSHOT_DIR, { recursive: true, force: true })
  rmSync(STAMP_FILE, { force: true })
  mkdirSync(DOWNLOAD_DIR, { recursive: true })

  const zipName = `metamask-chrome-${METAMASK_VERSION}.zip`
  const zipPath = path.join(DOWNLOAD_DIR, zipName)

  if (!existsSync(zipPath)) {
    await download(`${RELEASE_BASE}/v${METAMASK_VERSION}/${zipName}`, zipPath)
  }
  await verifyDigest(zipPath, zipName)

  mkdirSync(EXTENSION_DIR, { recursive: true })
  await execFileAsync('unzip', ['-q', '-o', zipPath, '-d', EXTENSION_DIR])

  const manifest = path.join(EXTENSION_DIR, 'manifest.json')
  if (!existsSync(manifest)) {
    throw new Error(`unzip produced no manifest.json in ${EXTENSION_DIR}`)
  }

  writeFileSync(STAMP_FILE, JSON.stringify({ version: METAMASK_VERSION }))
  return EXTENSION_DIR
}
