import { scenario } from './goldens'

/** The item without a timestamp is dropped from the list. */
export const unparsed = scenario([
  'send',
  'unparsedWithChain',
  'unparsedNoChain',
  'unparsedNoTimestamp',
])
