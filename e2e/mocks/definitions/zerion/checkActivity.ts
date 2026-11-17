/**
 * Zerion's address-activity lookup, which gates the onboarding Continue screen.
 *
 * Zerion's API sits behind Cloudflare, which challenges GitHub-hosted runners
 * and answers 403 with an HTML interstitial.
 */

import type { MockRequest } from '../../types.js'

/** EVM `0x…` and base58 Solana addresses, as they appear in the request body. */
const ADDRESS = /"(0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})"/g

export const zerionCheckActivity: MockRequest[] = [
  {
    url: /\/wallet\/check-activity\/v1$/,
    method: 'POST',
    // Echoes what was asked about rather than a recorded list, so the answer
    // stays correct if the extension changes how many addresses it derives.
    response: ({ body }) => ({
      meta: null,
      data: [...body.matchAll(ADDRESS)].map(([, address]) => ({
        address,
        active: false,
      })),
      errors: null,
    }),
  },
]
