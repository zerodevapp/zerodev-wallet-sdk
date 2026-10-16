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
