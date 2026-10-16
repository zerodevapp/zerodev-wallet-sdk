import { scenario } from './goldens'

/** Sepolia items sent from a Kernel account: no USD prices, and no network
 * fee because the bundler paid the gas. */
export const testnet = scenario([
  'sendSponsored',
  'sendSelfPaid',
  'batchSend',
  'batchSendMixed',
  'receiveNative',
])
