import { ZERODEV_AA_URL } from '../constants.js'

export function getAAUrl(projectId: string, chainId: number, aaUrl?: string) {
  return aaUrl || `${ZERODEV_AA_URL}${projectId}/chain/${chainId}`
}
