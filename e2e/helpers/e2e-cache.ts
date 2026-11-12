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
