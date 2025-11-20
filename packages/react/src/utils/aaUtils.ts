import { ZERODEV_AA_URL } from '../constants.js'

export function getAAUrl(chainId: number, aaUrl?: string) {
  return aaUrl || `${ZERODEV_AA_URL}${chainId}/chain/${chainId}`
}
