import { scenario } from './goldens'

export const approvals = scenario([
  'approveFungible',
  'approveUnlimited',
  'approveNft',
  'approveCollection',
  'revoke',
])
