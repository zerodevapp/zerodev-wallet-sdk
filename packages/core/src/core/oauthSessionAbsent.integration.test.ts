/**
 * Boundary: Wallet Core <-> KMS, at the `oauth` branch's sessionless success.
 *
 * A 200 with no `session` is guarded rather than deref'd: the rotation is
 * discarded and the payload is returned, so `auth()` **resolves and the user is
 * not logged in**. Whether that should instead reject is an open product
 * question, so nothing here asserts it either way — only what holds under both
 * answers: no session is committed, the pending key does not survive, and the
 * returned payload is intact, since it is the caller's only signal.
 *
 * `otp` verify has the same guard but cannot be driven in-process —
 * `encryptOtpAttempt` pins the HPKE envelope against a production key — so it is
 * covered by reading, not from here.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiKeyStamper, PasskeyStamper } from '../stampers/types.js'
import type { StorageAdapter } from '../storage/manager.js'
import { SessionType } from '../types/session.js'
import { createZeroDevWalletCore } from './createZeroDevWalletCore.js'

const sessionKey = (nth: number) => `02${String(nth).padStart(64, '0')}`

/** Exposes pending vs active so a discarded rotation is observable. */
function keyStore(): ApiKeyStamper & {
  activeKey: () => string | null
  pendingKey: () => string | null
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
    activeKey: () => active,
    pendingKey: () => pending,
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

/** Return this from `respond` to answer with a raw, non-JSON body. */
const rawBody = (body: string, contentType: string) => ({
  __raw: body,
  __contentType: contentType,
})

/**
 * `respond` is called per `/auth/oauth` request with the key the store currently
 * has pending — the oauth request body carries no public key, because the backend
 * holds the one registered against the server-side session.
 */
async function harness(respond: (pendingKey: string) => unknown) {
  const api = keyStore()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request) => {
      const path = String(url)
      const json = (payload: unknown) =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      if (path.includes('server-info/parent-org-id')) {
        return json({ parentOrgId: 'parent-org' })
      }
      if (path.includes('/auth/oauth')) {
        const answer = respond(api.pendingKey() ?? '') as Record<string, string>
        if (answer?.__raw !== undefined) {
          return new Response(answer.__raw, {
            status: 200,
            headers: { 'content-type': answer.__contentType },
          })
        }
        return json(answer)
      }
      return new Response('{}', { status: 404 })
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
  const core = await createZeroDevWalletCore({
    projectId: 'proj',
    rpId: 'localhost',
    sessionStorage: adapter,
    apiKeyStamper: api,
    passkeyStamper,
    proxyBaseUrl: 'https://kms.test.invalid/api/v1',
  })
  return { core, api }
}

const oauth = {
  type: 'oauth',
  provider: 'google',
  sessionId: 'oauth-session-1',
} as const

/**
 * Attributable = a caller can tell the response was at fault. A raw `TypeError`
 * reads like any other null deref, and a bare `Error('failed')` names nothing.
 */
function isAttributable(error: unknown) {
  return (
    error instanceof Error &&
    !(error instanceof TypeError) &&
    /session|response|oauth/i.test(error.message)
  )
}

/** Either remedy passes: resolve without a session, or reject attributably. */
async function endsWithoutMisleading(run: () => Promise<unknown>) {
  const outcome = await run().then(
    () => 'resolved' as const,
    (error: unknown) => error,
  )
  return outcome === 'resolved' || isAttributable(outcome)
}

/** How a caller keying on `session` would classify the outcome. */
async function classify(respond: (pendingKey: string) => unknown) {
  const { core } = await harness(respond)
  return core.auth(oauth).then(
    (result) =>
      (result as { session?: unknown })?.session ? 'logged-in' : 'sessionless',
    () => 'rejected',
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('oauth: the control', () => {
  it('commits the session when the response carries one', async () => {
    const { core, api } = await harness((pending) => ({
      session: token(pending),
    }))

    await core.auth(oauth)

    await expect(core.getSession()).resolves.toBeDefined()
    expect(api.activeKey()).toBe(sessionKey(1))
  })
})

describe('oauth: a 200 with no session', () => {
  const shapes: [string, () => unknown][] = [
    ['the field is absent', () => ({ userId: 'u', subOrganizationId: 'o' })],
    ['the field is null', () => ({ session: null })],
  ]

  for (const [label, respond] of shapes) {
    it(`resolves without a session and drops the rotation when ${label}`, async () => {
      const { core, api } = await harness(respond)

      await expect(core.auth(oauth)).resolves.toBeDefined()

      await expect(core.getSession()).resolves.toBeUndefined()
      expect(api.activeKey()).toBeNull()
      expect(api.pendingKey()).toBeNull()
    })
  }

  it('returns the payload unchanged, since it is the only signal', async () => {
    // Nothing else tells the caller they are not logged in: no throw, no
    // in-band flag. If the payload were swallowed there would be no way to know.
    const payload = { userId: 'user-1', subOrganizationId: 'suborg-1' }
    const { core } = await harness(() => payload)

    await expect(core.auth(oauth)).resolves.toEqual(payload)
  })

  it('does not hand out the discarded key on the next request for one', async () => {
    // `getPublicKey()` caches a prepared key for the oauth flow to consume. The
    // sessionless branch discards it, so serving the same value again would bind
    // a later session to a key the store no longer holds.
    const { core } = await harness(() => ({ session: null }))
    const before = await core.getPublicKey()

    await core.auth(oauth)

    expect(await core.getPublicKey()).not.toBe(before)
  })

  it('leaves a later oauth able to succeed', async () => {
    let sessionless = true
    const { core, api } = await harness((pending) =>
      sessionless ? { session: null } : { session: token(pending) },
    )
    await core.auth(oauth)
    await expect(core.getSession()).resolves.toBeUndefined()

    sessionless = false
    await core.auth(oauth)

    await expect(core.getSession()).resolves.toBeDefined()
    expect(api.activeKey()).toBe(sessionKey(2))
  })
})

describe('oauth: the response is not a response', () => {
  it.fails('stays attributable when the body is literally null', async () => {
    // `sessionResponseShape` covers `data.session` being absent on this branch —
    // this is `data` ITSELF being null, so the guard is what derefs. Today:
    // `TypeError: Cannot read properties of null (reading 'session')`.
    const { core } = await harness(() => null)

    expect(await endsWithoutMisleading(() => core.auth(oauth))).toBe(true)
    await expect(core.getSession()).resolves.toBeUndefined()
  })

  it.fails(
    'does not report a gateway interstitial as a sessionless login',
    async () => {
      // The transport's text fallback hands the HTML back as `data`, so
      // `!data.session` is trivially true and a proxy failure becomes
      // indistinguishable from "this user genuinely has no session" — which is a
      // legitimate outcome. Compared rather than asserted directly, so any remedy
      // that separates the two passes.
      const genuine = await classify(() => ({ userId: 'u' }))
      const gateway = await classify(() =>
        rawBody('<html>gateway timeout</html>', 'text/html'),
      )

      expect(gateway).not.toBe(genuine)
    },
  )
})

describe('oauth: the cached prepared key', () => {
  it('refuses a session bound to a different key than the cached one', async () => {
    // Only oauth consumes a key cached by `getPublicKey()`, so this path exists
    // nowhere else: if the backend answers for a different key, committing would
    // store a session the wallet cannot sign for.
    const { core, api } = await harness(() => ({
      session: token(sessionKey(99)),
    }))
    await core.getPublicKey()

    const caught = await core.auth(oauth).then(
      () => 'RESOLVED' as const,
      (error: unknown) => error,
    )

    expect(isAttributable(caught)).toBe(true)
    await expect(core.getSession()).resolves.toBeUndefined()
    expect(api.activeKey()).toBeNull()
  })
})
