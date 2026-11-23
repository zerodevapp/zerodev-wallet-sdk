/**
 * Zerion's API, which no Zerion context can reach from CI.
 *
 * `zpi.zerion.io` sits behind Cloudflare, which challenges GitHub-hosted
 * runners and answers `403` with `cf-mitigated: challenge` and an HTML
 * interstitial. Zerion reacts by loading `app.zerion.io/turnstile.html` into a
 * `<dialog>` over its own UI, and that dialog intercepts pointer events on
 * whatever sits beneath it — Continue during onboarding, Unlock afterwards.
 * It never resolves, because the challenge is never solved.
 *
 * So the whole host is served here rather than the one gating call.
 * `check-activity` additionally has to answer rather than refuse: the screen
 * carrying Continue never renders without it.
 *
 * Mocking only `check-activity` looks sufficient from a machine Cloudflare does
 * not challenge, because there every other call quietly succeeds. Measured on
 * a runner: the challenge arrives on `wallet/get-meta/v1`, and every request in
 * the chain that follows is page-originated, so `route` reaches all of it.
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

export const zerionApi: MockRequest[] = [
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
