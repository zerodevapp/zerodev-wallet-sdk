/**
 * Flow: two browser tabs of one origin refresh the same session at the same
 * instant (DPL-798).
 *
 * Tabs share the key vault (IndexedDB) and session storage, but each loads its
 * own copy of this module, so the module-level key-transition queue does not
 * serialize them. Each tab's stamper also caches the vault key in memory, like
 * Turnkey's IndexedDbStamper. The KMS stub fails a stamp login that overlaps
 * another one, as Turnkey does for one sub-org.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiKeyStamper, PasskeyStamper } from '../stampers/types.js'
import type { StorageAdapter } from '../storage/manager.js'
import { SessionType } from '../types/session.js'

const ORG = 'org-a'

const sessionKey = (nth: number) => `02${String(nth).padStart(64, '0')}`

/** The shared IndexedDB slot. */
function vault() {
  return { key: null as string | null, minted: 0 }
}

/** One tab's stamper: reads the vault at load, then signs from memory. */
function tabStamper(v: ReturnType<typeof vault>): ApiKeyStamper & {
  activeKey: () => string | null
} {
  let active = v.key
  let pending: string | null = null
  const stamp = async () => ({
    stampHeaderName: 'X-Stamp',
    stampHeaderValue: `stamp:${active}`,
  })
  return {
    stamp,
    clear: async () => {
      active = null
      pending = null
      v.key = null
    },
    getPublicKey: async () => active,
    resetKeyPair: async () => {
      active = sessionKey(++v.minted)
      v.key = active
    },
    prepareKeyRotation: async () => {
      pending = sessionKey(++v.minted)
      return pending
    },
    stampPending: stamp,
    signPending: async () => 'sig',
    commitKeyRotation: async () => {
      if (pending) {
        active = pending
        v.key = pending
      }
      pending = null
    },
    discardKeyRotation: async () => {
      pending = null
    },
    reload: async () => {
      active = v.key
    },
    sign: async () => 'sig',
    activeKey: () => active,
  }
}

const passkeyStamper: PasskeyStamper = {
  stamp: async () => ({ stampHeaderName: 'X-Stamp', stampHeaderValue: 'pk' }),
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
      user_id: 'user-a',
      organization_id: ORG,
    }),
  )}.sig`
}

function sharedStorage(): StorageAdapter {
  const store = new Map<string, string>()
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: (key) => {
      store.delete(key)
    },
  }
}

/** Counts stamp logins and fails one that overlaps another in flight. */
function stubKms() {
  const kms = { stampLogins: 0, failed: 0, inFlight: 0 }
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
      if (path.includes('/auth/login/stamp')) {
        kms.stampLogins++
        if (kms.inFlight > 0) {
          kms.failed++
          return json({ error: 'ACTIVITY_STATUS_FAILED' }, 500)
        }
        kms.inFlight++
        await new Promise((resolve) => setTimeout(resolve, 20))
        kms.inFlight--
        return json({ session: token(body.targetPublicKey) })
      }
      return json({}, 404)
    }),
  )
  return kms
}

/** An exclusive, in-memory stand-in for `navigator.locks`. */
function webLocks() {
  const tails = new Map<string, Promise<unknown>>()
  return {
    request: <T>(name: string, task: () => Promise<T>): Promise<T> => {
      const run = (tails.get(name) ?? Promise.resolve()).then(() => task())
      tails.set(
        name,
        run.catch(() => undefined),
      )
      return run
    },
  }
}

/** A fresh module instance, as a separate tab would load. */
async function loadTab() {
  vi.resetModules()
  return (await import('./createZeroDevWalletCore.js')).createZeroDevWalletCore
}

async function twoTabs() {
  const kms = stubKms()
  const v = vault()
  const adapter = sharedStorage()
  const open = async () => {
    const stamper = tabStamper(v)
    const core = await (await loadTab())({
      projectId: 'project-a',
      rpId: 'localhost',
      sessionStorage: adapter,
      apiKeyStamper: stamper,
      passkeyStamper,
      proxyBaseUrl: 'https://kms.test.invalid/api/v1',
    })
    return { core, stamper }
  }
  const tabA = await open()
  await tabA.core.auth({ type: 'passkey', mode: 'login' })
  const tabB = await open()
  kms.stampLogins = 0
  return { kms, v, tabA, tabB }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cross-tab session refresh', () => {
  it('sends one stamp login and both tabs end on its session and key', async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const { kms, v, tabA, tabB } = await twoTabs()
    const before = await tabA.core.getSession()

    const [fromA, fromB] = await Promise.all([
      tabA.core.refreshSession(before?.id),
      tabB.core.refreshSession(before?.id),
    ])

    expect(kms.stampLogins).toBe(1)
    expect(kms.failed).toBe(0)
    expect(fromA?.id).not.toBe(before?.id)
    expect(fromB?.id).toBe(fromA?.id)
    expect(tabA.stamper.activeKey()).toBe(v.key)
    expect(tabB.stamper.activeKey()).toBe(v.key)
    expect(fromB?.publicKey).toBe(v.key)
  })

  it('a tab refreshing after another already did adopts instead of sending a second', async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const { kms, tabA, tabB } = await twoTabs()
    const before = await tabA.core.getSession()

    const fromA = await tabA.core.refreshSession(before?.id)
    const fromB = await tabB.core.refreshSession(before?.id)

    expect(kms.stampLogins).toBe(1)
    expect(fromB?.id).toBe(fromA?.id)
    expect(tabB.stamper.activeKey()).toBe(fromA?.publicKey)
  })
})
