import { scenario } from './goldens'

/** A network fee, one without a price, a protocol fee on top, a fee the
 * mapper kept out of the protocol list, and a receive with no fee at all. */
export const fees = scenario([
  'feesNetworkOnly',
  'feesNoPrice',
  'feesWithProtocol',
  'feesNonUiAct',
  'receive',
])
