/**
 * Flow: two tabs of one origin over a real Core each, sharing the session
 * store and key vault. One tab's refresh is rejected after the other tab
 * already refreshed the same account; the provider must adopt that session
 * rather than drop it.
 */
import type {
  ApiKeyStamper,
  PasskeyStamper,
  StorageAdapter,
} from '@zerodev/wallet-core'
import { privateKeyToAccount } from 'viem/accounts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sepolia } from 'wagmi/chains'
import { createProvider } from './provider.js'
import { createZeroDevWalletStore } from './store.js'

const sessionKey = (nth: number) => `02${String(nth).padStart(64, '0')}`

/** One tab's stamper over the shared vault. */
function tabStamper(vault: { key: string | null; minted: number }) {
  let active = vault.key
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
      vault.key = null
    },
    getPublicKey: async () => active,
    resetKeyPair: async () => {
      active = sessionKey(++vault.minted)
      vault.key = active
    },
    prepareKeyRotation: async () => {
      pending = sessionKey(++vault.minted)
      return pending
    },
    stampPending: stamp,
    signPending: async () => 'sig',
    commitKeyRotation: async () => {
      if (pending) {
        active = pending
        vault.key = pending
      }
      pending = null
    },
    discardKeyRotation: async () => {
      pending = null
    },
    reload: async () => {
      active = vault.key
    },
    sign: async () => 'sig',
  } satisfies ApiKeyStamper
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

const token = (publicKey: string) =>
  `hdr.${btoa(
    JSON.stringify({
      exp: Date.now() + 3_600_000,
      public_key: publicKey,
      session_type: 'SESSION_TYPE_READ_WRITE',
      user_id: 'user-1',
      organization_id: 'org-1',
    }),
  )}.sig`

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

const json = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

function stubKms() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (path.includes('server-info/parent-org-id')) {
        return json({ parentOrgId: 'parent-org' })
      }
      if (path.includes('/auth/login/stamp')) {
        return json({ session: token(body.targetPublicKey) })
      }
      if (path.includes('auth/logout')) return json({ ok: true })
      if (path.includes('authenticators')) return json({ sessionKeys: [] })
      return new Response('{}', { status: 404 })
    }),
  )
}

/** A real Core in its own module instance, as a separate tab loads it. */
async function openTab(
  vault: { key: string | null; minted: number },
  storage: StorageAdapter,
) {
  vi.resetModules()
  const { createZeroDevWallet } = await import('@zerodev/wallet-core')
  return createZeroDevWallet({
    projectId: 'proj',
    rpId: 'localhost',
    sessionStorage: storage,
    apiKeyStamper: tabStamper(vault),
    passkeyStamper,
    proxyBaseUrl: 'https://kms.test.invalid/api/v1',
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('provider: a rejected refresh across tabs', () => {
  it('adopts the session another tab refreshed instead of dropping it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    stubKms()
    const vault = { key: null as string | null, minted: 0 }
    const storage = sharedStorage()
    const tabA = await openTab(vault, storage)
    await tabA.auth({ type: 'passkey', mode: 'login' })
    const tabB = await openTab(vault, storage)
    const stale = await tabB.getSession()
    if (!stale) throw new Error('Expected a session')
    const refreshed = await tabA.refreshSession(stale.id)
    // B's own refresh comes back rejected, as for a revoked key.
    vi.spyOn(tabB, 'refreshSession').mockRejectedValue({ status: 401 })

    const store = createZeroDevWalletStore()
    store.getState().setWallet(tabB)
    // Close to expiry, so the provider refreshes at once.
    store.getState().setSession({ ...stale, expiry: Date.now() + 30_000 })
    store.getState().setEoaAccount(privateKeyToAccount(`0x${'11'.repeat(32)}`))
    const provider = createProvider({
      store,
      config: { projectId: 'proj', chains: [sepolia] },
      chains: [sepolia],
    })

    await vi.waitFor(() =>
      expect(store.getState().session?.id).toBe(refreshed?.id),
    )
    expect(store.getState().eoaAccount).not.toBeNull()
    expect((await tabA.getSession())?.id).toBe(refreshed?.id)
    provider.destroy()
  })
})
