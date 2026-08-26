/**
 * Boundary between Wallet Core and KMS at `auth/init/otp`, the `sendOtp` branch
 * of `auth()`, and the only auth branch with no `withKeyTransition`, no
 * try/catch and no key rotation. That absence is correct, since verify prepares
 * its own key, so it is asserted rather than assumed.
 *
 * The branch simply returns `data`, while its declared return type promises
 * `{otpId, otpEncryptionTargetBundle}`, both of which the caller must carry to
 * verify, and `rest.ts` returns `data as any` so neither is checked. One defect,
 * in the `it.fails` block.
 */
import type { Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiKeyStamper, PasskeyStamper } from '../stampers/types.js'
import type { StorageAdapter } from '../storage/manager.js'
import { SessionType } from '../types/session.js'
import { createZeroDevWalletCore } from './createZeroDevWalletCore.js'

const OWNER = privateKeyToAccount(`0x${'11'.repeat(32)}` as Hex)
const sessionKey = (nth: number) => `02${String(nth).padStart(64, '0')}`

/** Exposes pending vs active so "no rotation was left behind" is observable. */
function keyStore(): ApiKeyStamper & {
  state: () => { active: string | null; pending: string | null }
} {
  let active: string | null = null
  let pending: string | null = null
  let minted = 0
  const stamp = async () => ({
    stampHeaderName: 'X-Stamp',
    stampHeaderValue: 'stamp',
  })
  return {
    stamp,
    clear: async () => {
      active = null
      pending = null
    },
    getPublicKey: async () => active,
    resetKeyPair: async () => {
      active = sessionKey(++minted)
    },
    prepareKeyRotation: async () => {
      pending = sessionKey(++minted)
      return pending
    },
    stampPending: stamp,
    signPending: async () => 'sig',
    commitKeyRotation: async () => {
      if (pending) active = pending
      pending = null
    },
    discardKeyRotation: async () => {
      pending = null
    },
    sign: async () => 'sig',
    state: () => ({ active, pending }),
  }
}

const passkeyStamper: PasskeyStamper = {
  stamp: async () => ({
    stampHeaderName: 'X-Stamp',
    stampHeaderValue: 'stamp',
  }),
  clear: async () => {},
  register: async () => ({
    attestation: {
      attestationObject: 'ao',
      clientDataJson: 'cdj',
      credentialId: 'cred-1',
    },
    encodedChallenge: 'challenge',
  }),
}

function token(publicKey: string) {
  return `hdr.${btoa(
    JSON.stringify({
      exp: Date.now() + 3_600_000,
      public_key: publicKey,
      session_type: SessionType.READ_WRITE,
      user_id: 'user-1',
      organization_id: 'suborg-1',
    }),
  )}.sig`
}

/** How `auth/init/otp` answers. */
type Reply = { body: unknown; status?: number } | { raw: string }

const USABLE = { otpId: 'otp-1', otpEncryptionTargetBundle: 'bundle' }

/**
 * The double answers a script and records paths; it branches on nothing. `sent`
 * is the `init/otp` bodies, `paths` every request, so "the auth proxy was never
 * reached" is assertable.
 */
async function build(initOtp: Reply) {
  const api = keyStore()
  const sent: unknown[] = []
  const paths: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      paths.push(path)
      const json = (payload: unknown, status = 200) =>
        new Response(JSON.stringify(payload), {
          status,
          headers: { 'content-type': 'application/json' },
        })

      if (path.includes('parent-org-id')) {
        return json({ parentOrgId: 'parent-org' })
      }
      if (path.includes('/auth/login/stamp')) {
        return json({ session: token(body.targetPublicKey) })
      }
      if (path.includes('/user-wallet')) {
        return json({ walletAddresses: [OWNER.address] })
      }
      if (path.includes('/auth/init/otp')) {
        sent.push(body)
        if ('raw' in initOtp) {
          return new Response(initOtp.raw, {
            status: 200,
            headers: { 'content-type': 'text/html' },
          })
        }
        return json(initOtp.body, initOtp.status ?? 200)
      }
      return json({}, 404)
    }),
  )

  const store = new Map<string, string>()
  const adapter: StorageAdapter = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: (key) => {
      store.delete(key)
    },
  }
  const sdk = await createZeroDevWalletCore({
    projectId: 'proj',
    rpId: 'localhost',
    sessionStorage: adapter,
    apiKeyStamper: api,
    passkeyStamper,
    proxyBaseUrl: 'https://kms.test.invalid/api/v1',
  })
  return { sdk, api, sent, paths }
}

const SEND = {
  type: 'otp',
  mode: 'sendOtp',
  email: 'user@example.com',
  contact: { type: 'email', contact: 'user@example.com' },
} as const

const outcomeOf = (p: Promise<unknown>) =>
  p.then(
    (value) => ({ ok: true, value }) as const,
    (error: unknown) => ({ ok: false, error }) as const,
  )

/** Rejects `''` so a `?? ''` "fix" cannot pass for a repair. */
const usable = (v: unknown) => typeof v === 'string' && v.length > 0

/** Both fields are required to reach verify at all. */
function carriesAUsableHandle(value: unknown) {
  if (!value || typeof value !== 'object') return false
  const handle = value as Record<string, unknown>
  return usable(handle.otpId) && usable(handle.otpEncryptionTargetBundle)
}

/** Attributable = an Error, not a raw deref, that names the OTP flow. */
const blamesTheSend = (error: unknown) =>
  error instanceof Error &&
  !(error instanceof TypeError) &&
  /otp|code|bundle/i.test(error.message)

/** Refuse attributably, or hand back a usable handle. Neither is the defect. */
const endsUsably = (outcome: Awaited<ReturnType<typeof outcomeOf>>) =>
  outcome.ok
    ? carriesAUsableHandle(outcome.value)
    : blamesTheSend(outcome.error)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('otp send: a healthy send', () => {
  it('returns a handle the verify step can use', async () => {
    const { sdk } = await build({ body: USABLE })

    const outcome = await outcomeOf(sdk.auth(SEND))

    expect(endsUsably(outcome)).toBe(true)
  })

  it('asks for the code with only the contact details', async () => {
    const { sdk, sent } = await build({ body: USABLE })

    await sdk.auth(SEND)

    // Sending a code is pre-authentication, so a key committed here would be
    // one nobody can ever use.
    expect(sent).toEqual([
      {
        email: 'user@example.com',
        contact: { type: 'email', contact: 'user@example.com' },
      },
    ])
  })

  it('sends the same request for a magic link', async () => {
    // A distinct branch normalizing into the same request builder, so it is
    // covered on its own.
    const { sdk, sent } = await build({ body: USABLE })

    await sdk.auth({
      type: 'magicLink',
      mode: 'send',
      email: 'user@example.com',
    })

    expect(sent).toEqual([
      {
        email: 'user@example.com',
        contact: { type: 'email', contact: 'user@example.com' },
      },
    ])
  })
})

describe('otp send: a 200 that carries no usable handle', () => {
  // DEFECT. Every shape below is reported as "the code was sent", so the user is
  // told to check their inbox and the failure surfaces at verify instead.
  // Predicate accepts either remedy and rejects `''`, so a `?? ''` stays
  // expected-fail while a real fix goes red — both proven. Observed failure with
  // `it()`: `expected false to be true`.
  const hollow: [string, Reply][] = [
    ['the body is empty', { body: {} }],
    ['there is no bundle', { body: { otpId: 'otp-1' } }],
    ['there is no otpId', { body: { otpEncryptionTargetBundle: 'bundle' } }],
    [
      'both fields are null',
      { body: { otpId: null, otpEncryptionTargetBundle: null } },
    ],
    [
      'the fields are not strings',
      { body: { otpId: 42, otpEncryptionTargetBundle: 7 } },
    ],
    ['the body is null', { body: null }],
    // Third instance of the `rest.ts` non-JSON-200 gap, after
    // `kmsFailureFidelity` and `oauthSessionAbsent`.
    ['the body is a gateway interstitial', { raw: '<html>timeout</html>' }],
  ]

  for (const [label, reply] of hollow) {
    it.fails(`reports a send it cannot support when ${label}`, async () => {
      const { sdk } = await build(reply)

      const outcome = await outcomeOf(sdk.auth(SEND))

      expect(endsUsably(outcome)).toBe(true)
    })
  }
})

describe('otp send: failures that are reported properly', () => {
  // Rate limiting is the expected failure here, so losing the status leaves a
  // caller unable to tell "slow down" from "broken".
  const failures: [string, number][] = [
    ['throttled', 429],
    ['server error', 500],
  ]

  for (const [label, status] of failures) {
    it(`propagates a ${label} response with its status intact`, async () => {
      const { sdk } = await build({
        body: { error: 'nope', message: 'try later' },
        status,
      })

      const outcome = await outcomeOf(sdk.auth(SEND))

      expect(outcome.ok).toBe(false)
      expect((outcome as { error: Error }).error).toBeInstanceOf(Error)
      expect((outcome as { error: Error }).error.message).toContain(
        String(status),
      )
    })
  }
})

describe('otp send: must not disturb what is already there', () => {
  it('prepares no key rotation, so a failed send leaves nothing behind', async () => {
    // Why `sendOtp` needs no `withKeyTransition` — and this catches anyone
    // adding a rotation here without a rollback.
    const { sdk, api } = await build({ body: { error: 'x' }, status: 500 })

    await outcomeOf(sdk.auth(SEND))

    expect(api.state()).toEqual({ active: null, pending: null })
    await expect(sdk.getAllSessions()).resolves.toEqual({})
  })

  it('leaves an established session and its key untouched', async () => {
    // A signed-in user adding a login method must not be logged out by it.
    const { sdk, api } = await build({ body: USABLE })
    await sdk.auth({ type: 'passkey', mode: 'login' })
    const before = await sdk.getAllSessions()
    const keyBefore = api.state()

    await sdk.auth(SEND)

    await expect(sdk.getAllSessions()).resolves.toEqual(before)
    expect(api.state()).toEqual(keyBefore)
  })

  it('leaves an established session untouched when the send fails', async () => {
    const { sdk, api } = await build({ body: { error: 'x' }, status: 429 })
    await sdk.auth({ type: 'passkey', mode: 'login' })
    const before = await sdk.getAllSessions()
    const keyBefore = api.state()

    await outcomeOf(sdk.auth(SEND))

    await expect(sdk.getAllSessions()).resolves.toEqual(before)
    expect(api.state()).toEqual(keyBefore)
  })
})

describe('otp verify: an unusable bundle fails closed', () => {
  // Driven directly, not through a hollow send, so these stay true once the send
  // is fixed. `encryptOtpAttempt` pins the enclave envelope, hence no wire call.
  const unusableBundles: [string, string | undefined][] = [
    ['it is missing entirely', undefined],
    ['it is empty', ''],
    ['it is not JSON', '<html>timeout</html>'],
    ['it is JSON but not a bundle', '{}'],
  ]

  for (const [label, bundle] of unusableBundles) {
    it(`refuses before any network call when ${label}`, async () => {
      const { sdk, api, paths } = await build({ body: USABLE })

      const outcome = await outcomeOf(
        sdk.auth({
          type: 'otp',
          mode: 'verifyOtp',
          otpId: 'otp-1',
          otpCode: '123456',
          otpEncryptionTargetBundle: bundle as string,
        }),
      )

      expect(outcome.ok).toBe(false)
      expect(paths.some((path) => path.includes('authproxy'))).toBe(false)
      expect(api.state().pending).toBeNull()
      await expect(sdk.getAllSessions()).resolves.toEqual({})
    })
  }
})
