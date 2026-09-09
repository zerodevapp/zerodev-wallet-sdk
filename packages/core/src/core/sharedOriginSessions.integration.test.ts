/**
 * Flow: two cores over one storage adapter and one key vault — a single browser
 * origin running two projects.
 *
 * The storage keys are global (`@zerodev/active_session`, `@zerodev/sessions`,
 * `@zerodev/session_transition`) and the storage manager's `withMutation` lock is
 * per manager, so the only thing serializing two cores over them is the
 * module-level key-transition queue.
 */
import type { Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiKeyStamper, PasskeyStamper } from '../stampers/types.js'
import type { StorageAdapter } from '../storage/manager.js'
import { SessionType } from '../types/session.js'
import { createZeroDevWalletCore } from './createZeroDevWalletCore.js'

const WALLET_A = privateKeyToAccount(`0x${'11'.repeat(32)}` as Hex)
const WALLET_B = privateKeyToAccount(`0x${'22'.repeat(32)}` as Hex)
const ORG_A = 'org-a'
const ORG_B = 'org-b'
const JOURNAL = '@zerodev/session_transition'

const walletOf = (org: string) => (org === ORG_B ? WALLET_B : WALLET_A)

const sessionKey = (nth: number) => `02${String(nth).padStart(64, '0')}`

function keyStore(): ApiKeyStamper & { activeKey: () => string | null } {
  let minted = 0
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

function token(publicKey: string, org: string) {
  return `hdr.${btoa(
    JSON.stringify({
      exp: Date.now() + 3_600_000,
      public_key: publicKey,
      session_type: SessionType.READ_WRITE,
      user_id: `user-of-${org}`,
      organization_id: org,
    }),
  )}.sig`
}

/** ONE store, shared by both cores. */
function sharedStorage() {
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

const orgOf = (bearer: string) => {
  try {
    return JSON.parse(atob(bearer.split('.')[1])).organization_id as string
  } catch {
    return 'none'
  }
}

/** `state.org` decides which organization the next stamp-login belongs to. */
function stubKms(
  state: { org: string },
  vault: { activeKey: () => string | null },
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      const headers = (init?.headers ?? {}) as Record<string, string>
      const bearer = (headers.Authorization ?? '').replace('Bearer ', '')
      const json = (payload: unknown, status = 200) =>
        new Response(JSON.stringify(payload), {
          status,
          headers: { 'content-type': 'application/json' },
        })

      if (path.includes('server-info/parent-org-id')) {
        return json({ parentOrgId: 'parent-org' })
      }
      if (path.includes('/auth/login/stamp')) {
        return json({ session: token(body.targetPublicKey, state.org) })
      }
      if (path.includes('/wallets')) {
        return json({ walletAddresses: [walletOf(orgOf(bearer)).address] })
      }
      if (path.includes('auth/logout')) return json({ ok: true })
      if (path.includes('authenticators')) {
        return json({
          sessionKeys: [{ ApiKey: vault.activeKey() ?? '', TurnkeyId: 'tk-1' }],
        })
      }
      return json({}, 404)
    }),
  )
}

const build = (
  api: ApiKeyStamper,
  adapter: StorageAdapter,
  projectId: string,
) =>
  createZeroDevWalletCore({
    projectId,
    rpId: 'localhost',
    sessionStorage: adapter,
    apiKeyStamper: api,
    passkeyStamper,
    proxyBaseUrl: 'https://kms.test.invalid/api/v1',
  })

const login = { type: 'passkey', mode: 'login' } as const

const caught = (p: Promise<unknown>) =>
  p.then(
    () => 'RESOLVED' as const,
    (error: unknown) => error,
  )

/** One origin: one vault, one store, two cores for two projects. */
async function origin() {
  const state = { org: ORG_A }
  const vault = keyStore()
  const store = sharedStorage()
  stubKms(state, vault)
  return {
    state,
    vault,
    store,
    projectA: await build(vault, store.adapter, 'project-a'),
    async addProjectB() {
      return build(vault, store.adapter, 'project-b')
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('shared origin: the control', () => {
  it('lists exactly the session it just created', async () => {
    const o = await origin()

    await o.projectA.auth(login)
    const session = await o.projectA.getSession()

    expect(Object.keys(await o.projectA.getAllSessions())).toEqual([
      session?.id,
    ])
    await expect(
      o.projectA.switchSession(session?.id as string),
    ).resolves.toMatchObject({ id: session?.id })
  })
})

describe('shared origin: a second project logs in', () => {
  it('leaves one active session for the whole origin', async () => {
    const o = await origin()
    await o.projectA.auth(login)

    o.state.org = ORG_B
    const projectB = await o.addProjectB()
    await projectB.auth(login)

    const fromA = await o.projectA.getSession()
    const fromB = await projectB.getSession()
    expect(Object.keys(await o.projectA.getAllSessions())).toHaveLength(1)
    expect(fromA?.id).toBe(fromB?.id)
    expect(fromA?.publicKey).toBe(o.vault.activeKey())
  })

  it('builds an account for the organization whose session it reports', async () => {
    const o = await origin()
    await o.projectA.auth(login)

    o.state.org = ORG_B
    const projectB = await o.addProjectB()
    await projectB.auth(login)

    // Holds whichever way the storage is keyed: today both cores share one
    // session, and if the keys were ever namespaced per project each would keep
    // its own. What must never happen is reporting one organization's session
    // while handing out another organization's wallet.
    const reported = await o.projectA.getSession()
    const account = await o.projectA.toAccount()

    expect(account.address).toBe(
      walletOf(reported?.organizationId as string).address,
    )
  })
})

describe('shared origin: concurrent logins across the two cores', () => {
  it('consumes the transition journal and settles on one key', async () => {
    const o = await origin()
    const projectB = await o.addProjectB()

    await Promise.all([o.projectA.auth(login), projectB.auth(login)])

    expect(o.store.store.has(JOURNAL)).toBe(false)
    const session = await o.projectA.getSession()
    expect(session?.publicKey).toBe(o.vault.activeKey())
    expect(Object.keys(await o.projectA.getAllSessions())).toHaveLength(1)
  })
})

describe('shared origin: local clearing is refused while a session is live', () => {
  it('refuses clearAllSessions and points at logout', async () => {
    const o = await origin()
    await o.projectA.auth(login)

    const error = await caught(o.projectA.clearAllSessions())

    expect((error as Error).message).toMatch(/logout/i)
    await expect(o.projectA.getSession()).resolves.toBeDefined()
  })

  it('lets logout clear what clearAllSessions would not', async () => {
    const o = await origin()
    await o.projectA.auth(login)

    await expect(o.projectA.logout()).resolves.toBe(true)

    await expect(o.projectA.getSession()).resolves.toBeUndefined()
    expect(o.vault.activeKey()).toBeNull()
    await expect(o.projectA.clearAllSessions()).resolves.toBeUndefined()
  })

  it('refuses to switch to anything but the active session', async () => {
    const o = await origin()
    await o.projectA.auth(login)

    const error = await caught(o.projectA.switchSession('session_other'))

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toMatch(/single active key vault/i)
  })
})
