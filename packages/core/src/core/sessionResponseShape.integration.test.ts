/**
 * Boundary: Wallet Core <-> KMS, at the one field every authenticated flow
 * depends on — `data.session` in a 200 response.
 *
 * Five flows commit a session through the same two-phase path
 * (`createReplacementSession` then `commitReplacementSession`), and they do NOT
 * agree on whether the field is checked first. `oauth` and `otp` verify guard it
 * (`if (!data.session)` → discard the rotation and return); passkey **register**,
 * passkey **login** and **refreshSession** pass it straight in. That asymmetry
 * inside one file is the argument that the guard is expected rather than a
 * design choice — three paths deref an absent session into a raw `TypeError`.
 *
 * The assertion holds under either remedy: rejecting attributably, and resolving
 * without committing a session the way `oauth` already does, both pass. Only an
 * unattributable throw fails — so a fix in either direction turns these green
 * rather than red.
 *
 * `otp`/`magicLink` verify is the fifth path and is NOT covered here: it cannot
 * be driven in-process. `encryptOtpAttempt` pins the HPKE envelope against
 * `TURNKEY_TLS_FETCHER_SIGN_PUBLIC_KEY` and Core passes no override, so the flow
 * fails closed before any request. It is guarded like `oauth` by reading.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiKeyStamper, PasskeyStamper } from '../stampers/types.js'
import type { StorageAdapter } from '../storage/manager.js'
import { SessionType } from '../types/session.js'
import { createZeroDevWalletCore } from './createZeroDevWalletCore.js'

function statefulStamper(): ApiKeyStamper & {
  pendingKey: () => string | null
} {
  let active: string | null = null
  let pending: string | null = null
  let n = 0
  const stamp = async () => ({
    stampHeaderName: 'X-Stamp',
    stampHeaderValue: 'stamp',
  })
  return {
    stamp,
    clear: async () => {},
    getPublicKey: async () => active,
    resetKeyPair: async () => {
      active = `02${String(++n).padStart(64, '0')}`
    },
    prepareKeyRotation: async () => {
      pending = `02${String(++n).padStart(64, '0')}`
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

/** A session token whose claims are valid unless `over` breaks one on purpose. */
function token(publicKey: string, over: Record<string, unknown> = {}) {
  return `hdr.${btoa(
    JSON.stringify({
      exp: Date.now() + 3_600_000,
      public_key: publicKey,
      session_type: SessionType.READ_WRITE,
      user_id: 'user-1',
      organization_id: 'suborg-1',
      ...over,
    }),
  )}.sig`
}

/**
 * Answers a script and decides nothing. `sessionResponse` is what every
 * session-bearing endpoint returns, so one fixture drives all four paths.
 */
function kms(sessionResponse: (targetPublicKey: string) => unknown) {
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
      if (path.includes('/auth/register/passkey')) {
        return json({
          userId: 'user-1',
          walletAddress: `0x${'1'.repeat(40)}`,
          subOrganizationId: 'suborg-1',
        })
      }
      if (path.includes('/auth/login/stamp')) {
        return json(sessionResponse(body.targetPublicKey))
      }
      if (path.includes('/auth/oauth')) {
        // The oauth request body carries no public key — the backend already
        // holds the key registered against the server-side session, and
        // `popSignature` is what proves possession. So the token has to be bound
        // to the key the store just prepared, which `harness` supplies.
        return json(sessionResponse(''))
      }
      return json({}, 404)
    }),
  )
}

/**
 * One fixture for all four paths. `sessionResponse` receives the target public
 * key the flow is committing to, taken from the request where the request
 * carries it and from the key store otherwise.
 */
async function harness(sessionResponse: (targetPublicKey: string) => unknown) {
  const api = statefulStamper()
  kms((fromRequest) => sessionResponse(fromRequest || (api.pendingKey() ?? '')))

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

const register = { type: 'passkey', mode: 'register' } as const
const login = { type: 'passkey', mode: 'login' } as const
const oauth = {
  type: 'oauth',
  provider: 'google',
  sessionId: 'oauth-session-1',
} as const

/**
 * Attributable = the caller can tell the session response was at fault. A raw
 * `TypeError` reads the same as a null deref anywhere else in the flow, and a
 * bare `Error('failed')` names nothing — both are rejected here on purpose, so
 * that neither a rethrown `TypeError` nor a message-less throw can pass for a
 * fix.
 */
function isAttributable(e: unknown) {
  return (
    e instanceof Error &&
    !(e instanceof TypeError) &&
    /session|jwt/i.test(e.message)
  )
}

/**
 * Both remedies pass: reject attributably, or resolve without a session the way
 * the `oauth` branch does. Whether Core should reject or resolve is the open
 * "sessionless OAuth" question and is deliberately not pinned.
 */
async function endsAttributably(run: () => Promise<unknown>) {
  const outcome = await run().then(
    () => 'resolved' as const,
    (e: unknown) => e,
  )
  return outcome === 'resolved' || isAttributable(outcome)
}

const ABSENT = { session: undefined }
const NULLED = { session: null }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('session response: a 200 that carries a session', () => {
  // The control. Without it, a guard that rejected every response would pass
  // every test below.
  it('commits the session on passkey login', async () => {
    const { core } = await harness((pk) => ({ session: token(pk) }))

    await core.auth(login)

    await expect(core.getSession()).resolves.toBeDefined()
  })

  it('commits the session on oauth', async () => {
    const { core } = await harness((pk) => ({ session: token(pk) }))

    await core.auth(oauth)

    await expect(core.getSession()).resolves.toBeDefined()
  })
})

describe('session response: the session field is missing from a 200', () => {
  // Each of these asserts the outcome AND that nothing was stored. Attributability
  // alone would be satisfied by resolving with a fabricated session, which is a
  // worse outcome than the `TypeError` — the pair is what makes these detect only
  // a real fix.
  it.fails('stays attributable on passkey register', async () => {
    // Today: `TypeError: Cannot read properties of undefined (reading
    // 'publicKey')`, thrown from `createReplacementSession`.
    const { core } = await harness(() => ABSENT)

    expect(await endsAttributably(() => core.auth(register))).toBe(true)
    await expect(core.getSession()).resolves.toBeUndefined()
  })

  it.fails('stays attributable on passkey login', async () => {
    const { core } = await harness(() => ABSENT)

    expect(await endsAttributably(() => core.auth(login))).toBe(true)
    await expect(core.getSession()).resolves.toBeUndefined()
  })

  it.fails('stays attributable when the session field is null', async () => {
    // The same deref, one message apart ("...of null"), so a fix that only
    // guards `undefined` still leaves this one red.
    const { core } = await harness(() => NULLED)

    expect(await endsAttributably(() => core.auth(login))).toBe(true)
    await expect(core.getSession()).resolves.toBeUndefined()
  })

  it('stays attributable on oauth, which already guards the field', async () => {
    const { core } = await harness(() => ABSENT)

    expect(await endsAttributably(() => core.auth(oauth))).toBe(true)
    await expect(core.getSession()).resolves.toBeUndefined()
  })

  it('commits no session on any path', async () => {
    const { core } = await harness(() => ABSENT)

    await core.auth(login).catch(() => {})
    await expect(core.getSession()).resolves.toBeUndefined()

    await core.auth(register).catch(() => {})
    await expect(core.getSession()).resolves.toBeUndefined()
  })
})

describe('session response: refreshSession is the third unguarded path', () => {
  /** Logs in for real, then makes the NEXT session response degenerate. */
  async function loggedInThenDegenerate(degenerate: unknown) {
    let live = false
    const { core } = await harness((pk) =>
      live ? degenerate : { session: token(pk) },
    )
    await core.auth(login)
    const before = await core.getSession()
    live = true
    return { core, before }
  }

  it.fails(
    'stays attributable when the refreshed session is missing',
    async () => {
      // Paired with the session already held: a fix must be attributable AND
      // leave the live session alone, so neither a bare throw nor a fix that
      // logs the user out can satisfy this.
      const { core, before } = await loggedInThenDegenerate(ABSENT)

      expect(await endsAttributably(() => core.refreshSession())).toBe(true)
      expect((await core.getSession())?.token).toBe(before?.token)
    },
  )

  it('leaves the existing session usable when the refresh fails', async () => {
    // The healthy half, and worth locking in: a failed refresh must not drop the
    // user to unauthenticated. The rotation is discarded, so the active key still
    // matches the session already stored and it keeps working until it expires.
    const { core, before } = await loggedInThenDegenerate(ABSENT)

    await core.refreshSession().catch(() => {})

    const after = await core.getSession()
    expect(after?.token).toBe(before?.token)
  })
})

describe('session response: the token is present but its claims are not usable', () => {
  // Regression cover for the guards between a hollow session and a wallet that
  // cannot sign. Not one guard: mutating `parseSession`'s field check reddens only
  // two of these, and a missing `user_id` is caught only accidentally, by the
  // storage journal.
  const cases: [string, (pk: string) => unknown][] = [
    [
      'a required claim is missing',
      (pk) => ({ session: token(pk, { user_id: undefined }) }),
    ],
    [
      'a required claim is empty',
      (pk) => ({ session: token(pk, { organization_id: '' }) }),
    ],
    [
      'the public key is empty',
      (pk) => ({ session: token(pk, { public_key: '' }) }),
    ],
    ['the expiry is zero', (pk) => ({ session: token(pk, { exp: 0 }) })],
    [
      'the session is already expired',
      (pk) => ({ session: token(pk, { exp: Date.now() - 1_000 }) }),
    ],
    [
      'the session type is unknown',
      (pk) => ({ session: token(pk, { session_type: 'WAT' }) }),
    ],
    ['the token is not a JWT', () => ({ session: 'not-a-jwt' })],
    [
      'the public key is another key',
      () => ({ session: token(`02${'f'.repeat(64)}`) }),
    ],
  ]

  for (const [label, response] of cases) {
    it(`rejects attributably and stores nothing when ${label}`, async () => {
      const { core } = await harness(response)

      const caught = await core.auth(login).then(
        () => 'RESOLVED' as const,
        (e: unknown) => e,
      )

      expect(isAttributable(caught)).toBe(true)
      await expect(core.getSession()).resolves.toBeUndefined()
    })
  }
})
