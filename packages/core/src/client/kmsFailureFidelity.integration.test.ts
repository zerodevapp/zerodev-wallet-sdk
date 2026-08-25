/**
 * Boundary: Wallet Core <-> KMS / doorway-kms (B1).
 *
 * `client/transports/rest.ts` is the entire KMS contract — all 14 auth and
 * signing actions go through it. One `fetch`, no retry, a 10 s default timeout,
 * and either `RestRequestError` (status + url + parsed body) or
 * `RestTimeoutError`.
 *
 * What these protect is failure fidelity: a caller has to tell a throttle from a
 * rejection from an outage, because the right response differs.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RestRequestError, RestTimeoutError } from '../errors/request.js'
import type { Stamper } from '../stampers/types.js'
import { rest } from './transports/rest.js'

const BASE = 'https://kms.example.invalid/api/v1'

const noopStamper: Stamper = {
  stamp: async () => ({
    stampHeaderName: 'X-Stamp',
    stampHeaderValue: 'stamp',
  }),
  clear: async () => {},
}

function transport(timeoutMs?: number) {
  return rest(BASE, {
    apiKeyStamper: noopStamper,
    passkeyStamper: noopStamper,
    ...(timeoutMs !== undefined && { timeoutMs }),
  })
}

/** Stubs `fetch` to answer once with the given status and body. */
function respondWith(
  status: number,
  body: unknown,
  contentType = 'application/json',
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(typeof body === 'string' ? body : JSON.stringify(body), {
          status,
          headers: { 'content-type': contentType },
        }),
    ),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('KMS boundary: HTTP failures stay distinguishable', () => {
  const cases = [
    { status: 401, label: 'rejected credential — re-authenticate' },
    { status: 403, label: 'forbidden — do not retry' },
    { status: 429, label: 'throttled — back off and retry' },
    { status: 500, label: 'server fault' },
    { status: 503, label: 'outage — back off' },
  ] as const

  for (const { status, label } of cases) {
    it(`preserves status ${status} on the thrown error (${label})`, async () => {
      respondWith(status, { error: 'some_code', message: 'human readable' })

      const err = await transport()
        .request({ path: 'whoami', stamp: false })
        .catch((e: unknown) => e)

      expect(err).toBeInstanceOf(RestRequestError)
      expect((err as RestRequestError).status).toBe(status)
      expect((err as RestRequestError).url).toContain('whoami')
    })
  }

  it('surfaces the backend error code and message, not just the status', async () => {
    respondWith(400, {
      error: 'otp_expired',
      message: 'The OTP has expired, request a new one',
    })

    const err = (await transport()
      .request({ path: 'login/otp', stamp: false })
      .catch((e) => e)) as RestRequestError

    expect(err.message).toContain('otp_expired')
    expect(err.message).toContain('The OTP has expired, request a new one')
    expect(err.body).toMatchObject({ error: 'otp_expired' })
  })

  it('still reports the status when the body is not JSON', async () => {
    respondWith(502, '<html>Bad Gateway</html>', 'text/html')

    const err = (await transport()
      .request({ path: 'whoami', stamp: false })
      .catch((e) => e)) as RestRequestError

    expect(err).toBeInstanceOf(RestRequestError)
    expect(err.status).toBe(502)
  })

  it('does not mistake a 2xx with an error-shaped body for a failure', async () => {
    respondWith(200, { error: null, message: 'ok', userId: 'user-1' })

    await expect(
      transport().request({ path: 'whoami', stamp: false }),
    ).resolves.toMatchObject({ userId: 'user-1' })
  })

  it.fails(
    'does not hand a non-JSON success body back as though it were the payload',
    async () => {
      // A gateway or CDN interstitial arriving with a 200. Today the text
      // fallback returns the HTML string as `data`, so callers treat it as a
      // response body: `auth({type:'oauth'})` reads `!data.session`, finds
      // nothing, and reports a legitimate sessionless login. The sibling client
      // `createAuthProxyClient` has the same gap, which is why neither checks
      // content-type before trusting a 200.
      respondWith(200, '<html>gateway timeout</html>', 'text/html')

      const outcome = await transport()
        .request({ path: 'whoami', stamp: false })
        .then(
          (data) => data,
          () => 'REJECTED' as const,
        )

      expect(outcome).toBe('REJECTED')
    },
  )
})

describe('KMS boundary: timeout is its own failure class', () => {
  it('raises RestTimeoutError, not a generic abort, when KMS never answers', async () => {
    // A fetch that never settles on its own — it only rejects once the
    // transport's own abort signal fires, so the 10 ms timeout is what ends it.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              const err = new Error('The operation was aborted')
              err.name = 'AbortError'
              reject(err)
            })
          }),
      ),
    )

    const err = await transport(10)
      .request({ path: 'whoami', stamp: false })
      .catch((e: unknown) => e)

    expect(err).toBeInstanceOf(RestTimeoutError)
    expect(err).not.toBeInstanceOf(RestRequestError)
    expect((err as RestTimeoutError).url).toContain('whoami')
  })

  it('lets a network-level failure through as itself', async () => {
    // `fetch` itself throws, as it does on DNS failure or connection refused.
    const failure = new TypeError('fetch failed')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw failure
      }),
    )

    const err = await transport()
      .request({ path: 'whoami', stamp: false })
      .catch((e: unknown) => e)

    expect(err).toBe(failure)
  })
})
