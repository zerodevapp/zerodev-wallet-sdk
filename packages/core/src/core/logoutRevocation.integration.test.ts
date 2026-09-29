/**
 * Boundary: Wallet Core <-> KMS, at `logout()`.
 *
 * Two remote steps run before anything local is erased: `getAuthenticators` to
 * find the Turnkey id of the key currently held, then `logout` to revoke it.
 * The invariant every case points at: the local API key is the only thing that
 * can sign, so erasing it on an unconfirmed revocation strands the user in a
 * session that is still live remotely. Keep local state unless sure.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiKeyStamper, PasskeyStamper } from '../stampers/types.js'
import type { StorageAdapter } from '../storage/manager.js'
import { SessionType } from '../types/session.js'
import { createZeroDevWalletCore } from './createZeroDevWalletCore.js'

/**
 * The nth key the store mints. `02` + a padded counter is the shape the real
 * `indexedDbStamper` emits (a compressed SEC1 P-256 key); the counter only keeps
 * successive keys distinct so a rotation is observable. Passkey login rotates
 * once, so the live key throughout this file is `sessionKey(1)`.
 */
const sessionKey = (nth: number) => `02${String(nth).padStart(64, '0')}`

/** Well-formed, and deliberately not the key the store holds. */
const NOT_THE_LIVE_KEY = `02${'a'.repeat(64)}`

/** Exposes the active key so "was the only signing key erased?" is observable. */
function statefulStamper(): ApiKeyStamper & { activeKey: () => string | null } {
  let active: string | null = null
  let pending: string | null = null
  let n = 0
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
      active = sessionKey(++n)
    },
    prepareKeyRotation: async () => {
      pending = sessionKey(++n)
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

type Plan = {
  /** Body for `GET /authenticators`, built from the key the store now holds. */
  authenticators: (activeKey: string) => unknown
  authenticatorsStatus?: number
  revocationStatus?: number
}

/**
 * Logs in for real so the session and the key are the ones Core actually holds,
 * then clears the request log so only the logout traffic is recorded. Answers a
 * script and decides nothing.
 */
async function loggedIn(plan: Plan) {
  const api = statefulStamper()
  const requests: { path: string; body: any }[] = []

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      const json = (payload: unknown, status = 200) =>
        new Response(JSON.stringify(payload), {
          status,
          headers: { 'content-type': 'application/json' },
        })

      if (path.includes('server-info/parent-org-id')) {
        return json({ parentOrgId: 'parent-org' })
      }
      requests.push({ path, body })

      if (path.includes('/auth/login/stamp')) {
        return json({ session: token(body.targetPublicKey) })
      }
      if (path.includes('/authenticators')) {
        return plan.authenticatorsStatus
          ? json(
              { message: 'authenticators failed' },
              plan.authenticatorsStatus,
            )
          : json(plan.authenticators(api.activeKey() ?? ''))
      }
      if (path.includes('/auth/logout')) {
        return plan.revocationStatus
          ? json({ message: 'revocation failed' }, plan.revocationStatus)
          : json({})
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
  const core = await createZeroDevWalletCore({
    projectId: 'proj',
    rpId: 'localhost',
    sessionStorage: adapter,
    apiKeyStamper: api,
    passkeyStamper,
    proxyBaseUrl: 'https://kms.test.invalid/api/v1',
  })
  await core.auth({ type: 'passkey', mode: 'login' })
  requests.length = 0

  return {
    core,
    api,
    revocations: () => requests.filter((r) => r.path.includes('/auth/logout')),
  }
}

/** The key list the backend returns today, keyed on the live session key. */
const MATCHING = (activeKey: string) => ({
  sessionKeys: [{ ApiKey: activeKey, TurnkeyId: 'turnkey-1' }],
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('logout: revocation confirmed', () => {
  it('revokes the key it actually holds, then erases local state', async () => {
    const { core, api, revocations } = await loggedIn({
      authenticators: MATCHING,
    })

    await expect(core.logout()).resolves.toBe(true)

    const sent = revocations()[0]?.body
    expect(sent?.parameters?.apiKeyIds).toEqual(['turnkey-1'])
    expect(sent?.parameters?.userId).toBe('user-1')
    expect(sent?.organizationId).toBe('suborg-1')
    await expect(core.getSession()).resolves.toBeUndefined()
    expect(api.activeKey()).toBeNull()
  })

  it('reads the forward-compatible key casing too', async () => {
    // The backend's Go model has no JSON tags today, so the wire casing is
    // `ApiKey`/`TurnkeyId`; the lower-cased pair is tolerated for when it gains
    // them. Dropping either half silently stops logout finding the key, which
    // lands in the refuse-to-erase branch below.
    const { core, revocations } = await loggedIn({
      authenticators: (activeKey) => ({
        sessionKeys: [{ apiKey: activeKey, turnkeyId: 'turnkey-1' }],
      }),
    })

    await expect(core.logout()).resolves.toBe(true)

    expect(revocations()[0]?.body?.parameters?.apiKeyIds).toEqual(['turnkey-1'])
  })
})

describe('logout: the remote key cannot be identified', () => {
  // Core has no id to revoke, so it must not touch the only key that can sign.
  const cases: [string, (activeKey: string) => unknown][] = [
    [
      'the key list does not mention it',
      () => ({
        sessionKeys: [{ ApiKey: NOT_THE_LIVE_KEY, TurnkeyId: 'x' }],
      }),
    ],
    ['the key list is null', () => ({ sessionKeys: null })],
    ['the key list is absent', () => ({})],
    [
      'the entry has no Turnkey id',
      (activeKey) => ({ sessionKeys: [{ ApiKey: activeKey }] }),
    ],
  ]

  for (const [label, authenticators] of cases) {
    it(`refuses and keeps local credentials when ${label}`, async () => {
      const { core, api, revocations } = await loggedIn({ authenticators })

      await expect(core.logout()).resolves.toBe(false)

      expect(revocations()).toHaveLength(0)
      await expect(core.getSession()).resolves.toBeDefined()
      expect(api.activeKey()).not.toBeNull()
    })
  }
})

describe('logout: the remote call fails inconclusively', () => {
  const cases: [string, Plan][] = [
    [
      'the key list is forbidden',
      { authenticators: MATCHING, authenticatorsStatus: 403 },
    ],
    [
      'the key list errors',
      { authenticators: MATCHING, authenticatorsStatus: 500 },
    ],
    ['revocation errors', { authenticators: MATCHING, revocationStatus: 500 }],
  ]

  for (const [label, plan] of cases) {
    it(`refuses and keeps local credentials when ${label}`, async () => {
      const { core, api } = await loggedIn(plan)

      await expect(core.logout()).resolves.toBe(false)

      await expect(core.getSession()).resolves.toBeDefined()
      expect(api.activeKey()).not.toBeNull()
    })
  }
})

describe('logout: a 401 is conclusive', () => {
  it('erases local state when the credential is already rejected', async () => {
    // The inverse risk to the guard above, and the reason the guard cannot simply
    // be "never erase on failure": a rejected credential can no longer sign
    // anything, so keeping it would strand the user in a session they cannot end.
    const { core, api } = await loggedIn({
      authenticators: MATCHING,
      authenticatorsStatus: 401,
    })

    await expect(core.logout()).resolves.toBe(true)

    await expect(core.getSession()).resolves.toBeUndefined()
    expect(api.activeKey()).toBeNull()
  })
})

describe('logout: force', () => {
  it('erases local state even though the key could not be identified', async () => {
    // Documented behaviour, not a defect: the API docstring says to use `force`
    // "only when accepting that the remote key may remain until expiry".
    const { core, api, revocations } = await loggedIn({
      authenticators: () => ({ sessionKeys: null }),
    })

    await expect(core.logout({ force: true })).resolves.toBe(true)

    expect(revocations()).toHaveLength(0)
    await expect(core.getSession()).resolves.toBeUndefined()
    expect(api.activeKey()).toBeNull()
  })

  it('still attempts revocation first when the key IS identifiable', async () => {
    // The docstring promises `force` "still tries remote revocation first". A
    // force that skipped straight to local erasure would orphan a key that could
    // have been revoked cleanly.
    const { core, revocations } = await loggedIn({ authenticators: MATCHING })

    await expect(core.logout({ force: true })).resolves.toBe(true)

    expect(revocations()).toHaveLength(1)
  })
})

describe('logout: local cleanup', () => {
  it('clears the session even when the key store fails to clear', async () => {
    // Both cleanups are attempted and the first error is rethrown afterwards. If
    // a throwing key store short-circuited the session erasure, logout would
    // leave a usable session token behind while reporting failure.
    const { core, api } = await loggedIn({ authenticators: MATCHING })
    api.clear = async () => {
      throw new Error('key store unavailable')
    }

    await expect(core.logout()).rejects.toThrow(/key store unavailable/)

    await expect(core.getSession()).resolves.toBeUndefined()
  })
})
