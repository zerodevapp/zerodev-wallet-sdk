/**
 * Boundary between Wallet Core and KMS across the two calls passkey registration
 * makes, in the `passkey`/`register` branch of `auth()`.
 *
 * `client.registerWithPasskey` creates the account and its wallet remotely, then
 * `client.loginWithStamp` obtains a session, with a key rotation between them. The
 * REST transport has no retry, so a 503/429/stall on the second call throws
 * straight out with the account already created.
 *
 * The `catch` calls `discardKeyRotation()` and rethrows, which is narrower than it
 * looks: `commitKeyRotation()` has already run one line after the create
 * succeeded, so the key store keeps an active API key from the abandoned attempt
 * while session storage is genuinely empty. Registering again creates a second
 * wallet as intended, and the cost of that path is an ambiguous login picker
 * rather than a lost wallet, which is not tested here.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiKeyStamper, PasskeyStamper } from '../stampers/types.js'
import type { StorageAdapter } from '../storage/manager.js'
import { SessionType } from '../types/session.js'
import { createZeroDevWalletCore } from './createZeroDevWalletCore.js'

/**
 * Tracks pending vs active the way a real key store does, so the rotation
 * sequencing in the flow under test is exercised rather than stubbed away.
 */
function statefulStamper(): ApiKeyStamper {
  let activeKey: string | null = null
  let pending: string | null = null
  let n = 0
  const stamp = async () => ({
    stampHeaderName: 'X-Stamp',
    stampHeaderValue: 'stamp',
  })
  return {
    stamp,
    clear: async () => {},
    getPublicKey: async () => activeKey,
    resetKeyPair: async () => {
      activeKey = `02${String(++n).padStart(64, '0')}`
    },
    prepareKeyRotation: async () => {
      pending = `02${String(++n).padStart(64, '0')}`
      return pending
    },
    stampPending: stamp,
    signPending: async () => 'sig',
    commitKeyRotation: async () => {
      if (pending) activeKey = pending
      pending = null
    },
    discardKeyRotation: async () => {
      pending = null
    },
    sign: async () => 'sig',
  }
}

/**
 * Mints a fresh credential per call, as both real stampers do, and survives a
 * failed registration the way a device-resident passkey does. On Core's side of
 * the boundary — it stands in for the SDK's own stampers, not for KMS.
 */
function freshPasskeyStamper(): PasskeyStamper {
  let n = 0
  return {
    stamp: async () => ({
      stampHeaderName: 'X-Stamp',
      stampHeaderValue: 'stamp',
    }),
    clear: async () => {},
    register: async () => ({
      attestation: {
        attestationObject: 'ao',
        clientDataJson: 'cdj',
        credentialId: `credential-${++n}`,
      },
      encodedChallenge: 'challenge',
    }),
  }
}

function sessionToken(publicKey: string, organizationId: string) {
  return `hdr.${btoa(
    JSON.stringify({
      exp: Date.now() + 3_600_000,
      public_key: publicKey,
      session_type: SessionType.READ_WRITE,
      user_id: 'user-1',
      organization_id: organizationId,
    }),
  )}.sig`
}

type RecordedRequest = { path: string; body: Record<string, unknown> }

/**
 * A recording transport. It answers what it is told to answer and decides
 * nothing: no account model, no dedupe rule, no branching on what a request
 * contains. The response values are arbitrary fixtures in the real response
 * shapes and no assertion reads them — the tests assert what Core sent and what
 * Core holds locally, so nothing here can turn a fact about a double into a
 * finding about Core.
 */
function recordingKms() {
  const requests: RecordedRequest[] = []
  const state = { failLogin: false }
  let accounts = 0

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

      if (path.includes('/auth/register/passkey')) {
        accounts += 1
        return json({
          userId: 'user-1',
          walletAddress: `0x${String(accounts).repeat(40).slice(0, 40)}`,
          subOrganizationId: `suborg-${accounts}`,
        })
      }

      if (path.includes('/auth/login/stamp')) {
        if (state.failLogin) {
          return json({ error: 'unavailable', message: 'KMS down' }, 503)
        }
        return json({
          session: sessionToken(body.targetPublicKey, `suborg-${accounts}`),
        })
      }

      return json({}, 404)
    }),
  )

  const to = (suffix: string) => requests.filter((r) => r.path.includes(suffix))

  return {
    requests,
    creates: () => to('/auth/register/passkey'),
    logins: () => to('/auth/login/stamp'),
    failLoginWith503: (on: boolean) => {
      state.failLogin = on
    },
  }
}

async function buildCore() {
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
  return createZeroDevWalletCore({
    projectId: 'proj',
    rpId: 'localhost',
    sessionStorage: adapter,
    apiKeyStamper: statefulStamper(),
    passkeyStamper: freshPasskeyStamper(),
    proxyBaseUrl: 'https://kms.test.invalid/api/v1',
  })
}

const register = { type: 'passkey', mode: 'register' } as const
const login = { type: 'passkey', mode: 'login' } as const

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('passkey registration: the happy path', () => {
  it('creates the account once and ends with a session', async () => {
    const kms = recordingKms()
    const core = await buildCore()

    await core.auth(register)

    expect(kms.creates()).toHaveLength(1)
    expect(kms.logins()).toHaveLength(1)
    await expect(core.getSession()).resolves.toBeDefined()
  })
})

describe('passkey registration: KMS fails between the two calls', () => {
  it('surfaces the failure and leaves no session, having already created the account', async () => {
    const kms = recordingKms()
    kms.failLoginWith503(true)
    const core = await buildCore()

    await expect(core.auth(register)).rejects.toThrow(/503/)

    expect(kms.creates()).toHaveLength(1)
    await expect(core.getSession()).resolves.toBeUndefined()
  })

  it('leaves the user able to log in with the passkey they already hold', async () => {
    // A CANARY, not a guard: three mutations to the failure path all survived,
    // because login rebuilds its own key rotation and nothing can un-create a
    // device-resident credential. It goes red only if a future change makes login
    // refuse while an interrupted registration is outstanding.
    const kms = recordingKms()
    kms.failLoginWith503(true)
    const core = await buildCore()
    await expect(core.auth(register)).rejects.toThrow(/503/)

    kms.failLoginWith503(false)
    await core.auth(login)

    const session = await core.getSession()
    expect(session).toBeDefined()
    expect(session?.sessionType).toBe(SessionType.READ_WRITE)
    expect(kms.creates()).toHaveLength(1)
  })
})
