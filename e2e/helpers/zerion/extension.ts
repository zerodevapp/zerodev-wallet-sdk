/**
 * Acquires the real Zerion Chrome build for the browser e2e suite.
 *
 * The release zip from Zerion's own public repo, so the suite drives the same
 * artifact users run.
 *
 * **The zip wraps everything in a versioned directory**
 * (`zerion-wallet-extension-v1.46.0/`), which is in direct tension with that
 * stable path. Unpacking it as-is would put `manifest.json` one level down and
 * move it on every bump, so `unpack` flattens the wrapper away.
 *
 * Unlike MetaMask the digest is a constant rather than fetched, because Zerion
 * publishes no `SHA256SUMS`. See `wallet-versions.ts` for the bump procedure.
 */

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import * as path from 'node:path'
import { promisify } from 'node:util'
import { walletCacheDir } from '../e2e-cache.js'
import { ZERION_VERSION, ZERION_ZIP_SHA256 } from '../wallet-versions.js'

const execFileAsync = promisify(execFile)

const RELEASE_BASE =
  'https://github.com/zeriontech/zerion-wallet-extension/releases/download'

/** Zerion's own directory under the shared `e2e/.cache` root. */
export const CACHE_ROOT = walletCacheDir('zerion')

/** Stable by contract — the extension id is a hash of this path. */
export const EXTENSION_DIR = path.join(CACHE_ROOT, 'extension')

/** The onboarded user-data-dir every test copies from. */
export const PROFILE_SNAPSHOT_DIR = path.join(CACHE_ROOT, 'profile')

const DOWNLOAD_DIR = path.join(CACHE_ROOT, 'download')
const STAMP_FILE = path.join(CACHE_ROOT, 'installed.json')

interface Stamp {
  version: string
  sha256: string
}

const readStamp = (): Stamp | null => {
  if (!existsSync(STAMP_FILE)) return null
  try {
    return JSON.parse(readFileSync(STAMP_FILE, 'utf8')) as Stamp
  } catch {
    return null
  }
}

const zipName = (version: string) => `zerion-wallet-extension-v${version}.zip`

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
 * Checks the zip against the digest we pinned.
 *
 * A mismatch indicates the downloaded zip does not match the expected digest.
 * Most likely a corrupted download.
 */
function verifyDigest(zipPath: string): void {
  const actual = createHash('sha256')
    .update(readFileSync(zipPath))
    .digest('hex')
  if (actual === ZERION_ZIP_SHA256) return

  // Delete it. Leaving a bad zip cached turns one bad download into a
  // permanently red suite that a re-run cannot clear.
  rmSync(zipPath, { force: true })
  throw new Error(
    `Zerion ${ZERION_VERSION} digest mismatch\n` +
      `  expected ${ZERION_ZIP_SHA256}\n` +
      `  actual   ${actual}\n` +
      'The release asset is immutable, so this is a bad download or a ' +
      'half-updated wallet-versions.ts. The file has been deleted; re-run.',
  )
}

/**
 * Unpacks the zip into `EXTENSION_DIR`, flattening the versioned wrapper
 * directory so `manifest.json` lands at the top level.
 */
async function unpack(zipPath: string): Promise<void> {
  const staging = `${EXTENSION_DIR}.partial`
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })

  try {
    await execFileAsync('unzip', ['-q', '-o', zipPath, '-d', staging])

    const entries = readdirSync(staging)
    if (entries.length !== 1) {
      throw new Error(
        `expected one top-level directory in ${zipName(ZERION_VERSION)}, ` +
          `found ${entries.length}: ${entries.join(', ')}`,
      )
    }
    const inner = path.join(staging, entries[0])
    if (!existsSync(path.join(inner, 'manifest.json'))) {
      throw new Error(`no manifest.json inside ${entries[0]}`)
    }

    const manifest = JSON.parse(
      readFileSync(path.join(inner, 'manifest.json'), 'utf8'),
    ) as { version?: string }
    if (manifest.version !== ZERION_VERSION) {
      throw new Error(
        `zip manifest says version ${manifest.version}, but ZERION_VERSION is ` +
          `${ZERION_VERSION}. Update e2e/helpers/wallet-versions.ts.`,
      )
    }

    rmSync(EXTENSION_DIR, { recursive: true, force: true })
    mkdirSync(path.dirname(EXTENSION_DIR), { recursive: true })
    renameSync(inner, EXTENSION_DIR)
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

/**
 * Downloads, verifies and unpacks Zerion if the cache does not already hold the
 * pinned version. Returns the directory to hand to `--load-extension`.
 *
 * `ZERION_ZIP_PATH` overrides the download with a local file, which is both the
 * offline path and the recovery path if GitHub is unreachable.
 */
export async function ensureZerionExtension(): Promise<string> {
  const stamp = readStamp()
  if (
    stamp?.version === ZERION_VERSION &&
    stamp.sha256 === ZERION_ZIP_SHA256 &&
    existsSync(path.join(EXTENSION_DIR, 'manifest.json'))
  ) {
    return EXTENSION_DIR
  }

  rmSync(EXTENSION_DIR, { recursive: true, force: true })
  rmSync(PROFILE_SNAPSHOT_DIR, { recursive: true, force: true })
  rmSync(STAMP_FILE, { force: true })
  mkdirSync(DOWNLOAD_DIR, { recursive: true })

  const override = process.env.ZERION_ZIP_PATH
  const zipPath = override ?? path.join(DOWNLOAD_DIR, zipName(ZERION_VERSION))

  if (override) {
    if (!existsSync(override)) {
      throw new Error(`ZERION_ZIP_PATH points at nothing: ${override}`)
    }
  } else if (!existsSync(zipPath)) {
    await download(
      `${RELEASE_BASE}/v${ZERION_VERSION}/${zipName(ZERION_VERSION)}`,
      zipPath,
    )
  }

  verifyDigest(zipPath)
  await unpack(zipPath)

  writeFileSync(
    STAMP_FILE,
    JSON.stringify({ version: ZERION_VERSION, sha256: ZERION_ZIP_SHA256 }),
  )
  return EXTENSION_DIR
}
