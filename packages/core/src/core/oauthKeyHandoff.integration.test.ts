/**
 * Flow: the OAuth prepared-key handoff.
 *
 * `getPublicKey` prepares a key rotation and caches it; the caller sends that key
 * as `pub_key` on the login URL; `auth({ type: 'oauth' })` consumes it a round trip
 * later. `/auth/oauth` re-sends only `{ sessionId, popSignature }`, so the session
 * that comes back must already be bound to the prepared key.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiKeyStamper, PasskeyStamper } from '../stampers/types.js'
import type { StorageAdapter } from '../storage/manager.js'
import { SessionType } from '../types/session.js'
import { createZeroDevWalletCore } from './createZeroDevWalletCore.js'

const sessionKey = (nth: number) => `02${String(nth).padStart(64, '0')}`

function keyStore(): ApiKeyStamper & {
  activeKey: () => string | null
  prepareCount: () => number
} {
  let minted = 0
  let prepares = 0
  let active: string | null = null
  let pending: string | null = null
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
      prepares += 1
      pending = sessionKey(++minted)
      return pending
    },
    stampPending: stamp,
    signPending: async () => 'popsig',
    commitKeyRotation: async () => {
      if (pending) active = pending
      pending = null
    },
    discardKeyRotation: async () => {
      pending = null
    },
    sign: async () => 'sig',
    activeKey: () => active,
    prepareCount: () => prepares,
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

function storage() {
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
  return { adapter, store }
}

type KmsOptions = {
  /** The key the next `/auth/oauth` session is bound to, or null for no session. */
  bindTo: () => string | null
  /** Serves the authenticator list, so `logout` can revoke rather than decline. */
  vault: { activeKey: () => string | null }
}

function stubKms(options: KmsOptions) {
  const loginUrlPubKeys: (string | null)[] = []
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
      if (path.includes('login-url')) {
        loginUrlPubKeys.push(new URL(path).searchParams.get('pub_key'))
        return json('https://accounts.google.com/o/oauth2/v2/auth?nonce=abc')
      }
      if (path.includes('/auth/oauth')) {
        const bound = options.bindTo()
        return json({ session: bound ? token(bound) : undefined })
      }
      if (path.includes('/auth/login/stamp')) {
        return json({ session: token(body.targetPublicKey) })
      }
      if (path.includes('auth/logout')) return json({ ok: true })
      if (path.includes('authenticators')) {
        return json({
          sessionKeys: [
            { ApiKey: options.vault.activeKey() ?? '', TurnkeyId: 'tk-1' },
          ],
        })
      }
      return json({}, 404)
    }),
  )
  return { loginUrlPubKeys }
}

const build = (api: ApiKeyStamper, adapter: StorageAdapter) =>
  createZeroDevWalletCore({
    projectId: 'proj',
    rpId: 'localhost',
    sessionStorage: adapter,
    apiKeyStamper: api,
    passkeyStamper,
    proxyBaseUrl: 'https://kms.test.invalid/api/v1',
  })

const login = { type: 'passkey', mode: 'login' } as const
const oauth = {
  type: 'oauth',
  provider: 'google',
  sessionId: 'sid-1',
} as const

const caught = (p: Promise<unknown>) =>
  p.then(
    () => 'RESOLVED' as const,
    (error: unknown) => error,
  )

/** The handoff, driven the way `authenticateOAuth` drives it. */
async function handoff() {
  const api = keyStore()
  let handedOff: string | null = null
  const kms = stubKms({ bindTo: () => handedOff, vault: api })
  const core = await build(api, storage().adapter)
  return {
    api,
    core,
    kms,
    /** Step 1: prepare a key and send it as `pub_key`, as the caller does. */
    async begin() {
      handedOff = await core.getPublicKey()
      await core.client.getOAuthLoginUrl({
        provider: 'google',
        projectId: 'proj',
        publicKey: handedOff as string,
        returnTo: 'https://app.test/',
      })
      return handedOff as string
    },
    /** Bind the returned session to something other than the handed-off key. */
    bindToOther() {
      handedOff = sessionKey(99)
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('oauth handoff: the key that leaves is the key that returns', () => {
  it('sends the prepared key as pub_key on the login url', async () => {
    const flow = await handoff()

    const prepared = await flow.begin()

    expect(flow.kms.loginUrlPubKeys).toEqual([
      prepared.replace(/^0x/, '').toLowerCase(),
    ])
  })

  it('commits the session bound to the key it handed off', async () => {
    const flow = await handoff()
    const prepared = await flow.begin()

    await flow.core.auth(oauth)

    await expect(flow.core.getSession()).resolves.toMatchObject({
      publicKey: prepared,
    })
    expect(flow.api.activeKey()).toBe(prepared)
  })

  it('refuses a session bound to a different key and commits nothing', async () => {
    const flow = await handoff()
    await flow.begin()
    flow.bindToOther()

    const error = await caught(flow.core.auth(oauth))

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(TypeError)
    await expect(flow.core.getSession()).resolves.toBeUndefined()
    expect(flow.api.activeKey()).toBeNull()
  })
})

describe('oauth handoff: asking twice must not invalidate it', () => {
  it('returns the same key and prepares one rotation', async () => {
    const flow = await handoff()

    const first = await flow.core.getPublicKey()
    const second = await flow.core.getPublicKey()

    expect(second).toBe(first)
    expect(flow.api.prepareCount()).toBe(1)
  })

  it('does not offer a consumed key again', async () => {
    const flow = await handoff()
    const prepared = await flow.begin()
    await flow.core.auth(oauth)

    const next = await flow.core.getPublicKey()

    expect(next).not.toBe(prepared)
  })
})

describe('oauth handoff: something else lands mid-journey', () => {
  it('never commits a session the vault cannot sign for', async () => {
    const flow = await handoff()
    await flow.core.auth(login)
    await flow.begin()
    await flow.core.refreshSession()

    await caught(flow.core.auth(oauth))

    const session = await flow.core.getSession()
    expect(session?.publicKey ?? null).toBe(flow.api.activeKey())
  })

  it('fails closed when a logout dropped the prepared key', async () => {
    const flow = await handoff()
    await flow.core.auth(login)
    await flow.begin()
    await expect(flow.core.logout()).resolves.toBe(true)

    const error = await caught(flow.core.auth(oauth))

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(TypeError)
    await expect(flow.core.getSession()).resolves.toBeUndefined()
    expect(flow.api.activeKey()).toBeNull()
  })
})
