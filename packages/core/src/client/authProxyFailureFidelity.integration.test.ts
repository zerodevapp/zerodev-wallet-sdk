/**
 * Boundary: Wallet Core <-> Turnkey's Auth Proxy.
 *
 * `createAuthProxyClient` talks to a hardcoded `https://authproxy.turnkey.com`,
 * with its own request function that shares none of `rest.ts`'s behaviour
 *
 * The unit under test is the client itself rather than `auth()`
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAuthProxyClient } from './authProxy.js'

const VERIFY_URL = 'https://authproxy.turnkey.com/v1/otp_verify_v2'
const ATTEMPT = { otpId: 'otp-1', encryptedOtpBundle: 'sealed-bundle' }

/** A well-formed verification token: three segments, `id` in the payload. */
const TOKEN = `hdr.${btoa(JSON.stringify({ id: 'token-1' }))}.sig`

function client() {
  return createAuthProxyClient({ authProxyConfigId: 'cfg-1' })
}

/**
 * `typeof t === 'string'` alone would accept `''`, so a `?? ''` in the client
 * would flip the hollow-token tests red as though the defect were fixed.
 */
function isUsableToken(token: unknown) {
  return typeof token === 'string' && token.length > 0
}

/** Stubs `fetch` to answer once with the given status, body and content type. */
function respondWith(
  status: number,
  body: string,
  contentType = 'application/json',
) {
  const fetchMock = vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(body, { status, headers: { 'content-type': contentType } }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('auth proxy: the contract that must keep holding', () => {
  it('returns the verification token the proxy issued', async () => {
    respondWith(200, JSON.stringify({ verificationToken: TOKEN }))

    const result = await client().verifyOtp(ATTEMPT)

    expect(result.verificationToken).toBe(TOKEN)
  })

  it('sends the sealed attempt and the config id to the verification endpoint', async () => {
    const fetchMock = respondWith(
      200,
      JSON.stringify({ verificationToken: TOKEN }),
    )

    await client().verifyOtp(ATTEMPT)

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe(VERIFY_URL)
    expect(new Headers(init?.headers).get('X-Auth-Proxy-Config-Id')).toBe(
      'cfg-1',
    )
    expect(JSON.parse(String(init?.body))).toEqual(ATTEMPT)
  })

  it('reports a throttle as a throttle, with the status and the body', async () => {
    respondWith(429, 'slow down', 'text/plain')

    await expect(client().verifyOtp(ATTEMPT)).rejects.toThrow(
      /Auth Proxy request failed: 429.*slow down/,
    )
  })

  it('reports a server error as a server error, with the body intact', async () => {
    respondWith(500, JSON.stringify({ error: 'enclave unavailable' }))

    await expect(client().verifyOtp(ATTEMPT)).rejects.toThrow(
      /Auth Proxy request failed: 500.*enclave unavailable/,
    )
  })
})

describe('auth proxy: what a caller is left with when the response is wrong', () => {
  // The assertions below are shaped to hold under ANY remedy — rejecting is one,
  // returning something actionable is another — so they check "did I end up with
  // a usable token" rather than "did it throw". Asserting rejection would turn a
  // legitimate fix red.

  it.fails(
    'does not report success when the response carries no verification token',
    async () => {
      // Today: resolves with `{}`, so `usable` is false. Downstream that becomes
      // `jwt.split(undefined)` inside `buildClientSignature`.
      respondWith(200, JSON.stringify({}))

      const usable = await client()
        .verifyOtp(ATTEMPT)
        .then(
          (r) => isUsableToken(r.verificationToken),
          () => true, // rejecting is a perfectly good remedy
        )

      expect(usable).toBe(true)
    },
  )

  it.fails(
    'does not report success when the verification token is null',
    async () => {
      respondWith(200, JSON.stringify({ verificationToken: null }))

      const usable = await client()
        .verifyOtp(ATTEMPT)
        .then(
          (r) => isUsableToken(r.verificationToken),
          () => true,
        )

      expect(usable).toBe(true)
    },
  )

  it.fails('attributes a non-JSON success body to the auth proxy', async () => {
    // A 200 carrying HTML, as a gateway or CDN interstitial would. Today
    // `response.json()` throws `SyntaxError: Unexpected token '<'`.
    respondWith(200, '<html>gateway timeout</html>', 'text/html')

    const error = await client()
      .verifyOtp(ATTEMPT)
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(SyntaxError)
    expect((error as Error).message).toMatch(/auth proxy/i)
  })

  it.fails('does not wait forever on a proxy that never answers', async () => {
    // A fetch that never settles, with fake timers so the clock is advanced
    // rather than waited on. Today nothing aborts it, so `settled` stays false.
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    )

    let settled = false
    const pending = client()
      .verifyOtp(ATTEMPT)
      .then(
        () => {
          settled = true
        },
        () => {
          settled = true
        },
      )

    await vi.advanceTimersByTimeAsync(60_000)
    // Deliberately not awaited — awaiting a request with no timeout IS the hang
    // under test.
    expect(pending).toBeInstanceOf(Promise)

    expect(settled).toBe(true)
  })
})
