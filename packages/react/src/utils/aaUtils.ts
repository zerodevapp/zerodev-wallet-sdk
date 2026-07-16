import {
  ZERODEV_AA_HOST,
  ZERODEV_AA_PROVIDER,
  ZERODEV_AA_VERSION,
} from '../constants.js'

/**
 * Builds the ZeroDev AA bundler/paymaster URL for a project + chain.
 *
 * The chainId is always appended, so this is multichain-safe. Consumers may
 * override only the host (`aaHost`, e.g. a staging/self-hosted origin); the
 * API version, path shape, and default provider are owned by the SDK.
 */
export function getAAUrl(projectId: string, chainId: number, aaHost?: string) {
  const host = (aaHost ?? ZERODEV_AA_HOST).replace(/\/+$/, '')
  return `${host}/api/${ZERODEV_AA_VERSION}/${projectId}/chain/${chainId}?provider=${ZERODEV_AA_PROVIDER}`
}
