/**
 * Boundary between Wallet Core and KMS at `server-info/auth-proxy-id`.
 *
 * Two units in one file because the id passes through both:
 * `getAuthProxyConfigId` fetches it and `createAuthProxyClient` sends it as an
 * `X-Auth-Proxy-Config-Id` header. Both are driven directly, since `auth()`
 * reaches them only through the `verifyOtp` branch, where `encryptOtpAttempt`
 * runs first against a pinned enclave key.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAuthProxyConfigId } from '../actions/auth/getAuthProxyConfigId.js'
import type { Stamper } from '../stampers/types.js'
import { createAuthProxyClient } from './authProxy.js'
import { rest } from './transports/rest.js'
import type { Client } from './types.js'

const BASE = 'https://kms.example.invalid/api/v1'
const CONFIG_ID_URL = `${BASE}/server-info/auth-proxy-id`
const VERIFY_URL = 'https://authproxy.turnkey.com/v1/otp_verify_v2'

const noopStamper: Stamper = {
  stamp: async () => ({
    stampHeaderName: 'X-Stamp',
    stampHeaderValue: 'stamp',
  }),
  clear: async () => {},
}

const transport = () =>
  rest(BASE, {
    apiKeyStamper: noopStamper,
    passkeyStamper: noopStamper,
  }) as unknown as Client

/** Answers the config-id request once with the given status, body, type. */
function respondWith(
  status: number,
  body: unknown,
  contentType = 'application/json',
) {
  const calls: { url: string; init?: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), ...(init && { init }) })
      return new Response(
        typeof body === 'string' ? body : JSON.stringify(body),
        { status, headers: { 'content-type': contentType } },
      )
    }),
  )
  return calls
}

const outcomeOf = (p: Promise<unknown>) =>
  p.then(
    (value) => ({ ok: true, value }) as const,
    (error: unknown) => ({ ok: false, error }) as const,
  )

/** Rejects `''` so a `?? ''` coercion cannot pass for a repair. */
const usable = (v: unknown) => typeof v === 'string' && v.length > 0

/** Attributable = an Error that is not a raw deref and names the thing. */
const blamesTheConfigId = (error: unknown) =>
  error instanceof Error &&
  !(error instanceof TypeError) &&
  /config|proxy|auth/i.test(error.message)

/** Refuse attributably, or return an id the proxy can be addressed with. */
const endsUsably = (outcome: Awaited<ReturnType<typeof outcomeOf>>) =>
  outcome.ok
    ? typeof outcome.value === 'object' &&
      outcome.value !== null &&
      usable(
        (outcome.value as { authProxyConfigId?: unknown }).authProxyConfigId,
      )
    : blamesTheConfigId(outcome.error)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('auth proxy config id: fetching it', () => {
  it('returns an id the proxy can be addressed with', async () => {
    respondWith(200, { authProxyConfigId: 'cfg-1' })

    const outcome = await outcomeOf(getAuthProxyConfigId(transport()))

    expect(endsUsably(outcome)).toBe(true)
  })

  it('asks for it with a bare GET and no credentials', async () => {
    const calls = respondWith(200, { authProxyConfigId: 'cfg-1' })

    await getAuthProxyConfigId(transport())

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(CONFIG_ID_URL)
    expect(calls[0].init?.method).toBe('GET')
    const headers = (calls[0].init?.headers ?? {}) as Record<string, unknown>
    expect(headers.Authorization).toBeUndefined()
  })

  const failures: [string, number][] = [
    ['a rejected caller', 401],
    ['a missing endpoint', 404],
    ['a throttle', 429],
    ['a server fault', 500],
  ]

  for (const [label, status] of failures) {
    it(`propagates ${label} with the status intact`, async () => {
      respondWith(status, { error: 'nope', message: 'try later' })

      const outcome = await outcomeOf(getAuthProxyConfigId(transport()))

      expect(outcome.ok).toBe(false)
      expect((outcome as { error: Error }).error.message).toContain(
        String(status),
      )
    })
  }
})

describe('auth proxy config id: a 200 that carries no usable id', () => {
  // DEFECT. `rest.ts` returns `data as any`, so every shape below resolves and
  // the declared `{ authProxyConfigId: string }` is not respected. The `null`
  // case is the worst as the caller destructures the result, so it gets a TypeError
  const hollow: [string, unknown, string?][] = [
    ['the field is absent', {}],
    ['it is null', { authProxyConfigId: null }],
    ['it is an empty string', { authProxyConfigId: '' }],
    ['it is not a string', { authProxyConfigId: 42 }],
    ['the field is misspelled', { configId: 'cfg-1' }],
    ['the body is null', null],
    ['the body is a gateway interstitial', '<html>timeout</html>', 'text/html'],
  ]

  for (const [label, body, contentType] of hollow) {
    it.fails(`returns an unusable id when ${label}`, async () => {
      respondWith(200, body, contentType)

      const outcome = await outcomeOf(getAuthProxyConfigId(transport()))

      expect(endsUsably(outcome)).toBe(true)
    })
  }
})

describe('auth proxy config id: addressing the proxy with a bad one', () => {
  const badIds: [string, unknown][] = [
    ['undefined', undefined],
    ['null', null],
    ['an empty string', ''],
  ]

  for (const [label, id] of badIds) {
    it(`still spends a proxy round trip when the id is ${label}`, async () => {
      const calls = respondWith(200, { verificationToken: 'vt' })
      const proxy = createAuthProxyClient({ authProxyConfigId: id as string })

      await outcomeOf(
        proxy.verifyOtp({ otpId: 'otp-1', encryptedOtpBundle: 'sealed' }),
      )

      expect(calls).toHaveLength(1)
      expect(calls[0].url).toBe(VERIFY_URL)
      const headers = (calls[0].init?.headers ?? {}) as Record<string, unknown>
      expect(usable(headers['X-Auth-Proxy-Config-Id'])).toBe(false)
    })
  }

  it('sends a usable id through unchanged', async () => {
    const calls = respondWith(200, { verificationToken: 'vt' })
    const proxy = createAuthProxyClient({ authProxyConfigId: 'cfg-1' })

    await proxy.verifyOtp({ otpId: 'otp-1', encryptedOtpBundle: 'sealed' })

    const headers = (calls[0].init?.headers ?? {}) as Record<string, unknown>
    expect(headers['X-Auth-Proxy-Config-Id']).toBe('cfg-1')
  })
})
