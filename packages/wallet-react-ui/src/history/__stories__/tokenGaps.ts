import { scenario } from './goldens'

export const tokenGaps = scenario([
  'tokenNoSymbol',
  'tokenNoName',
  'tokenNoPrice',
  'tokenNoDecimals',
  'tokenNoImage',
  'nftReceiveNoName',
  'nftReceiveNoImage',
  'transferNoAssetInfo',
])
