import { scenario } from './goldens'

export const chains = scenario([
  'chainNoExplorer',
  'chainNoIcon',
  { id: 'statusPending', chain: 'longName' },
  { id: 'executeNoAsset', chain: 'unknown' },
])
