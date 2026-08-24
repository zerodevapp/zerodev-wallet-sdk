/**
 * Boundary: Wallet Core <-> the platform authenticator, reached through the
 * injected `passkeyStamper` — `register()` on the register branch of `auth()`,
 * and `stamp()` on the login branch via `loginWithStamp`.
 *
 * A cancelled ceremony must reach the caller still recognisable as one:
 * `@zerodev/wallet-react-ui`'s `isCancellationError` keys on `err.name` being
 * `AbortError` or `NotAllowedError`, so rewrapping either turns "I changed my
 * mind" into a full-screen error takeover. The inverse costs as much — a real
 * authenticator failure relabelled as a cancellation gets filtered out, leaving
 * the user with no wallet and no error at all.
 *
 * Whether Core should translate a cancellation into something friendlier is a
 * product call and is deliberately not asserted. Only pass-through is.
 *
 * This seam is HEALTHY as probed — no defect, so no `it.fails` here. The tests
 * exist because the pass-through is one `throw error` that a later refactor can
 * quietly wrap.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiKeyStamper, PasskeyStamper, Stamp } from '../stampers/types.js'
import type { StorageAdapter } from '../storage/manager.js'
import { SessionType } from '../types/session.js'
import { createZeroDevWalletCore } from './createZeroDevWalletCore.js'

/**
 * Tracks pending vs active the way a real key store does, and exposes both so
 * the rollback can be asserted as key-store state rather than as a call count.
 */
function statefulStamper(): ApiKeyStamper & {
  activeKey: () => string | null
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
    activeKey: () => active,
    pendingKey: () => pending,
  }
}

/**
 * Stands in for the OS ceremony. `failures` is consumed one entry per call, so
 * a `[cancel]` script fails the first attempt and lets the retry through — the
 * shape of "the user cancelled, then tried again".
 */
function ceremonyStamper(opts: {
  registerFailures?: unknown[]
  stampFailures?: unknown[]
}) {
  const registerFailures = [...(opts.registerFailures ?? [])]
  const stampFailures = [...(opts.stampFailures ?? [])]
  let registers = 0
  let stamps = 0
  const stamper: PasskeyStamper = {
    stamp: async (): Promise<Stamp> => {
      stamps += 1
      if (stampFailures.length) throw stampFailures.shift()
      return { stampHeaderName: 'X-Stamp', stampHeaderValue: 'stamp' }
    },
    clear: async () => {},
    register: async () => {
      registers += 1
      if (registerFailures.length) throw registerFailures.shift()
      return {
        attestation: {
          attestationObject: 'ao',
          clientDataJson: 'cdj',
          credentialId: `cred-${registers}`,
        },
        encodedChallenge: 'challenge',
      }
    },
  }
  return {
    ...stamper,
    registers: () => registers,
    stamps: () => stamps,
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

/**
 * Records requests and answers a script. It decides nothing: no branching on
 * request content, and no assertion reads the response fixtures.
 */
function recordingKms() {
  const requests: string[] = []

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

      // Resolved on construction, before any ceremony — not part of the flow
      // under test, so it is answered without being recorded.
      if (path.includes('server-info/parent-org-id')) {
        return json({ parentOrgId: 'parent-org' })
      }

      requests.push(path)

      if (path.includes('/auth/register/passkey')) {
        return json({
          userId: 'user-1',
          walletAddress: `0x${'1'.repeat(40)}`,
          subOrganizationId: 'suborg-1',
        })
      }
      if (path.includes('/auth/login/stamp')) {
        return json({ session: sessionToken(body.targetPublicKey, 'suborg-1') })
      }
      return json({}, 404)
    }),
  )

  const to = (suffix: string) => requests.filter((p) => p.includes(suffix))

  return {
    creates: () => to('/auth/register/passkey'),
    logins: () => to('/auth/login/stamp'),
  }
}

async function buildCore(passkeyStamper: PasskeyStamper, api: ApiKeyStamper) {
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
    apiKeyStamper: api,
    passkeyStamper,
    proxyBaseUrl: 'https://kms.test.invalid/api/v1',
  })
}

const register = { type: 'passkey', mode: 'register' } as const
const login = { type: 'passkey', mode: 'login' } as const

/** The real ceremonies reject with a `DOMException`, so the double does too. */
const cancellation = (name: 'NotAllowedError' | 'AbortError') =>
  new DOMException(
    name === 'AbortError' ? 'ceremony timed out' : 'user cancelled',
    name,
  )

const caughtFrom = (p: Promise<unknown>) =>
  p.then(
    () => 'RESOLVED' as const,
    (e: unknown) => e,
  )

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('passkey ceremony: the ceremony is on the path at all', () => {
  it('runs the ceremony and completes the registration', async () => {
    const kms = recordingKms()
    const stamper = ceremonyStamper({})

    await (await buildCore(stamper, statefulStamper())).auth(register)

    expect(stamper.registers()).toBe(1)
    expect(kms.creates()).toHaveLength(1)
  })

  it('runs the ceremony and completes the login', async () => {
    const kms = recordingKms()
    const stamper = ceremonyStamper({})
    const core = await buildCore(stamper, statefulStamper())

    await core.auth(login)

    expect(stamper.stamps()).toBe(1)
    expect(kms.logins()).toHaveLength(1)
    await expect(core.getSession()).resolves.toBeDefined()
  })
})

describe('passkey ceremony: a cancellation stays a cancellation', () => {
  // `name` only. Wrapping while preserving the name would still satisfy
  // `isCancellationError`, so asserting error identity would fail a legitimate
  // change.
  const names = ['NotAllowedError', 'AbortError'] as const

  for (const name of names) {
    it(`surfaces a ${name} from the registration ceremony under its own name`, async () => {
      recordingKms()
      const core = await buildCore(
        ceremonyStamper({ registerFailures: [cancellation(name)] }),
        statefulStamper(),
      )

      const caught = await caughtFrom(core.auth(register))

      expect(caught).toBeInstanceOf(Error)
      expect((caught as Error).name).toBe(name)
    })

    it(`surfaces a ${name} from the login ceremony under its own name`, async () => {
      recordingKms()
      const core = await buildCore(
        ceremonyStamper({ stampFailures: [cancellation(name)] }),
        statefulStamper(),
      )

      const caught = await caughtFrom(core.auth(login))

      expect(caught).toBeInstanceOf(Error)
      expect((caught as Error).name).toBe(name)
    })
  }
})

describe('passkey ceremony: a real failure must not pass for a cancellation', () => {
  // The inverse of the tests above, and the more expensive direction to get
  // wrong: a failure wearing a cancellation's name is filtered out by
  // `isCancellationError`, so the user is shown nothing and gets no wallet.
  const cancellationNames = ['NotAllowedError', 'AbortError']

  it('keeps a broken registration ceremony distinguishable', async () => {
    recordingKms()
    const core = await buildCore(
      ceremonyStamper({
        registerFailures: [new Error('authenticator unavailable')],
      }),
      statefulStamper(),
    )

    const caught = await caughtFrom(core.auth(register))

    expect(caught).toBeInstanceOf(Error)
    expect(cancellationNames).not.toContain((caught as Error).name)
  })

  it('keeps a broken login ceremony distinguishable', async () => {
    recordingKms()
    const core = await buildCore(
      ceremonyStamper({
        stampFailures: [new Error('authenticator unavailable')],
      }),
      statefulStamper(),
    )

    const caught = await caughtFrom(core.auth(login))

    expect(caught).toBeInstanceOf(Error)
    expect(cancellationNames).not.toContain((caught as Error).name)
  })
})

describe('passkey ceremony: cancelling costs nothing', () => {
  it('reaches KMS not at all when the registration ceremony is cancelled', async () => {
    const kms = recordingKms()
    const api = statefulStamper()
    const core = await buildCore(
      ceremonyStamper({ registerFailures: [cancellation('NotAllowedError')] }),
      api,
    )

    await caughtFrom(core.auth(register))

    // Nothing was created remotely, so unlike a failure BETWEEN the two
    // registration calls there is nothing to reconcile afterwards.
    expect(kms.creates()).toHaveLength(0)
    expect(kms.logins()).toHaveLength(0)
    await expect(core.getSession()).resolves.toBeUndefined()
    expect(api.activeKey()).toBeNull()
    expect(api.pendingKey()).toBeNull()
  })

  it('reaches KMS not at all when the login ceremony is cancelled', async () => {
    const kms = recordingKms()
    const api = statefulStamper()
    const core = await buildCore(
      ceremonyStamper({ stampFailures: [cancellation('NotAllowedError')] }),
      api,
    )

    await caughtFrom(core.auth(login))

    expect(kms.logins()).toHaveLength(0)
    await expect(core.getSession()).resolves.toBeUndefined()
    expect(api.pendingKey()).toBeNull()
  })
})

describe('passkey ceremony: the user can simply try again', () => {
  // CANARIES, not guards: no mutation to the failure path kills these, because a
  // cancelled attempt leaves nothing behind for a retry to trip over. They go red
  // only if a later change makes an attempt refuse while a cancelled one is
  // outstanding.
  it('registers on the attempt after a cancelled one', async () => {
    const kms = recordingKms()
    const core = await buildCore(
      ceremonyStamper({ registerFailures: [cancellation('NotAllowedError')] }),
      statefulStamper(),
    )
    await caughtFrom(core.auth(register))

    await core.auth(register)

    expect(kms.creates()).toHaveLength(1)
    await expect(core.getSession()).resolves.toBeDefined()
  })

  it('logs in on the attempt after a cancelled one', async () => {
    const kms = recordingKms()
    const core = await buildCore(
      ceremonyStamper({ stampFailures: [cancellation('AbortError')] }),
      statefulStamper(),
    )
    await caughtFrom(core.auth(login))

    await core.auth(login)

    expect(kms.logins()).toHaveLength(1)
    await expect(core.getSession()).resolves.toBeDefined()
  })
})
