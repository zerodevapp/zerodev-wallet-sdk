/**
 * Zerion's API, which the onboarding walk cannot reach from CI.
 *
 * `zpi.zerion.io` sits behind Cloudflare, which challenges GitHub-hosted
 * runners and answers 403 with an HTML interstitial. That breaks onboarding
 * twice over, so the whole host is served here rather than the one gating call:
 *
 * - `check-activity` takes the derived addresses, and the screen carrying
 *   Continue never renders without an answer.
 * - Any other 403 paints Cloudflare's Turnstile widget as a `<dialog>` over the
 *   extension UI, which then intercepts the click on Continue even once that
 *   screen is up.
 *
 * Mocking only `check-activity` looks sufficient from a machine Cloudflare does
 * not challenge, because there every other call quietly succeeds.
 */

import type { MockRequest } from '../../types.js'

/** EVM `0x…` and base58 Solana addresses, as they appear in the request body. */
const ADDRESS = /"(0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})"/g

const ZPI = /\/\/zpi\.zerion\.io\//

/** Shaped like Zerion's own errors, so a refusal reads as one to the extension. */
const refused = {
  meta: null,
  data: null,
  errors: [{ title: 'not served to the e2e suite' }],
}

export const zerionCheckActivity: MockRequest[] = [
  {
    url: /\/wallet\/check-activity\/v1$/,
    method: 'POST',
    priority: 1,
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
  { url: ZPI, method: 'GET', status: 404, response: refused },
  { url: ZPI, method: 'POST', status: 404, response: refused },
]
