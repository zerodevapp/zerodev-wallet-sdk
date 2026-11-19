/**
 * Pinned wallet-extension versions for the browser e2e suite.
 *
 * **Deliberately a file containing nothing else.** CI keys its `e2e/.cache`
 * restore on a hash of this file, so a version bump invalidates the cache and
 * anything else, a comment or a new helper, does not. Put only version
 * constants here.
 *
 * Bumping a version starts the upgrade procedure. The next run re-downloads,
 * re-verifies the digest, and re-onboards, because the stamp beside the cached
 * extension no longer matches. That is also when the onboarding walk for that
 * wallet may need its selectors updated.
 */

/** https://github.com/MetaMask/metamask-extension/releases */
export const METAMASK_VERSION = '13.46.1'

/**
 * Zerion. https://github.com/zeriontech/zerion-wallet-extension/releases
 *
 * We compute the digest ourselves. Zerion ships no `SHA256SUMS` and
 * no attestation, unlike MetaMask. So unlike the MetaMask helper, which fetches
 * the sums file fresh on every rebuild, this one compares against a constant.
 *
 * To bump: download the new `.zip` asset, take its sha256, and update both
 * constants together.
 *
 *   gh release download v<new> --repo zeriontech/zerion-wallet-extension \
 *     --pattern 'zerion-wallet-extension-*.zip'
 *   shasum -a 256 zerion-wallet-extension-v<new>.zip
 */
export const ZERION_VERSION = '1.46.0'
export const ZERION_ZIP_SHA256 =
  'a28e8e34dbe8b6a95cac3b1b81f5e5368c099a365e72b78c2b99fff299b125e2'
