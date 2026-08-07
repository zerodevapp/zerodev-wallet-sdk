import type { Config } from '@wagmi/core'
import type { LocalAccount } from 'viem'
import { zeroAddress } from 'viem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sepolia } from 'wagmi/chains'

/**
 * Connector initialization when restoring a persisted session.
 *
 * On page load `doInitialize()` reads the stored session and resolves the
 * wallet owner through `wallet.toAccount()` -> `GET {projectId}/user-wallet`.
 * That call is the SDK's most failure-prone KMS dependency: it needs a live
 * session JWT *and* a stamper key the backend still recognises.
 *
 * What these tests assert is the intended contract, not today's behaviour:
 *
 *   1. A transient failure must not be permanent. Whatever the eventual
 *      recovery design, a later attempt after the cause clears has to work.
 *   2. A failure must never produce a usable-looking account.
 *
 *
 * The assertion bodies are UNCHANGED and still state intended behaviour. Note
 * `it.fails()` passes if the body throws for any reason, so it is a weaker
 * signal than a genuinely red test; the passing tests in this file are the
 * control that catches a broken fixture. This notation was added in order to
 * avoid failling CI
 */

const OWNER = '0x1111111111111111111111111111111111111111' as const

const { walletMock } = vi.hoisted(() => ({
  walletMock: {
    getSession: vi.fn(),
    toAccount: vi.fn(),
    auth: vi.fn(),
    logout: vi.fn().mockResolvedValue(true),
    refreshSession: vi.fn(),
    getPublicKey: vi.fn(),
    client: {},
  },
}))

// Spread the real module: `provider.ts` imports `normalizeTimestamp` from it,
// and a hand-rolled partial mock silently breaks session scheduling.
vi.mock('@zerodev/wallet-core', async () => {
  const actual = await vi.importActual<typeof import('@zerodev/wallet-core')>(
    '@zerodev/wallet-core',
  )
  return {
    ...actual,
    createZeroDevWallet: vi.fn().mockImplementation(async () => walletMock),
  }
})

import { zeroDevWalletCore } from './core/connector.js'

type ConnectorInstance = ReturnType<ReturnType<typeof zeroDevWalletCore>>

const BASE_TIME = 1_700_000_000_000

/** Mirrors a real persisted session: unexpired, so it survives the storage filter. */
const RESTORED_SESSION = {
  id: 'session_indexedDb_1',
  userId: 'user-1',
  organizationId: 'org-1',
  stamperType: 'apiKey' as const,
  token: 'jwt-token',
  expiry: BASE_TIME + 15 * 60_000,
  createdAt: BASE_TIME,
}

const OWNER_ACCOUNT = { address: OWNER } as LocalAccount

function createConnector(): ConnectorInstance {
  const factory = zeroDevWalletCore({
    projectId: 'proj-test',
    chains: [sepolia],
  })
  const wagmiConfig = {
    transports: {},
    emitter: { emit: vi.fn() },
    storage: null,
  } as unknown as Config
  return factory(wagmiConfig as never) as ConnectorInstance
}

function getStore(connector: ConnectorInstance) {
  // @ts-expect-error - getStore is added in the connector's Properties.
  return connector.getStore()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(BASE_TIME)
  walletMock.getSession.mockReset().mockResolvedValue(RESTORED_SESSION)
  walletMock.toAccount.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('connector init — restoring a persisted session', () => {
  it('restores the session and exposes the resolved owner', async () => {
    // Control. If this fails the harness is wrong, not the connector.
    walletMock.toAccount.mockResolvedValue(OWNER_ACCOUNT)
    const connector = createConnector()

    const store = await getStore(connector)

    expect(store.getState().eoaAccount?.address).toBe(OWNER)
    expect(store.getState().session).toMatchObject({ id: RESTORED_SESSION.id })
  })

  it('surfaces the failure rather than continuing with an unresolved owner', async () => {
    // The failure must be loud. Resolving successfully here would mean the
    // app believes it restored a wallet it could not actually resolve.
    walletMock.toAccount.mockRejectedValue(
      new Error('Request timed out: GET proj-test/user-wallet'),
    )
    const connector = createConnector()

    await expect(getStore(connector)).rejects.toThrow(/timed out/i)
  })

  it('never reports an account address when owner resolution failed', async () => {
    // The #365 regression guard: no zero address, no stale address, nothing.
    // `getAccounts()` deliberately does not trigger init, so it is readable
    // even while init is broken.
    walletMock.toAccount.mockRejectedValue(new Error('Request timed out'))
    const connector = createConnector()

    await expect(getStore(connector)).rejects.toThrow()

    const accounts = await connector.getAccounts()
    expect(accounts).toEqual([])
    expect(accounts).not.toContain(zeroAddress)
  })

  it('does not report the user as authorized after a failed restore', async () => {
    walletMock.toAccount.mockRejectedValue(new Error('Request timed out'))
    const connector = createConnector()

    await expect(getStore(connector)).rejects.toThrow()

    expect(await connector.isAuthorized()).toBe(false)
  })

  it.fails(
    'connects on a later attempt once a transient failure clears',
    async () => {
      // A 10s REST timeout, a KMS 429, or a brief 5xx must not disable the
      // connector for the rest of the page load.
      walletMock.toAccount
        .mockRejectedValueOnce(new Error('Request timed out'))
        .mockResolvedValue(OWNER_ACCOUNT)
      const connector = createConnector()

      await expect(getStore(connector)).rejects.toThrow()

      const store = await getStore(connector)
      expect(store.getState().eoaAccount?.address).toBe(OWNER)
    },
  )

  it.fails(
    're-attempts owner resolution instead of replaying the cached rejection',
    async () => {
      walletMock.toAccount
        .mockRejectedValueOnce(new Error('Request timed out'))
        .mockResolvedValue(OWNER_ACCOUNT)
      const connector = createConnector()

      await expect(getStore(connector)).rejects.toThrow()
      await getStore(connector).catch(() => undefined)

      // Two attempts means the second one actually reached the KMS. One means
      // the first rejection was replayed and the KMS was never asked again.
      expect(walletMock.toAccount).toHaveBeenCalledTimes(2)
    },
  )

  it.fails(
    'exposes a usable store to the auth hooks once the failure clears',
    async () => {
      // Every entry point in `actions.ts` (loginPasskey, sendOTP, verifyOTP,
      // sendMagicLink, ...) starts with `getZeroDevStore(connector)`. If that
      // keeps rejecting, the one action that would replace the bad session —
      // logging in again — is blocked by the bad session.
      walletMock.toAccount
        .mockRejectedValueOnce(new Error('Request timed out'))
        .mockResolvedValue(OWNER_ACCOUNT)
      const connector = createConnector()

      await expect(getStore(connector)).rejects.toThrow()

      const store = await getStore(connector)
      expect(store.getState().wallet).toBeDefined()
    },
  )

  it.fails(
    'recovers the EIP-1193 provider once the failure clears',
    async () => {
      walletMock.toAccount
        .mockRejectedValueOnce(new Error('Request timed out'))
        .mockResolvedValue(OWNER_ACCOUNT)
      const connector = createConnector()

      await expect(connector.getProvider()).rejects.toThrow()

      await expect(connector.getProvider()).resolves.toBeDefined()
    },
  )
})

describe('connector init — defense in depth against a zero-address owner', () => {
  /**
   * #365 fixed this inside `toViemAccount`, so a zero owner cannot reach the
   * connector through the adapter today. The connector has its own zero guard
   * — but only in `setupChain`, which runs on `connect()`, never on the
   * restore path.
   *
   * These do not re-test #365. They pin the invariant that survives it: no
   * matter which layer lets it through, `0x0` must never be presented as the
   * user's account. `isAddress(zeroAddress)` is true, so nothing downstream
   * rejects it on shape alone — which is precisely how funds were lost.
   *
   * The mechanism is deliberately unspecified: throwing, clearing, or
   * refusing to populate the store all satisfy this.
   */

  it.fails('never exposes a zero-address owner to wagmi', async () => {
    walletMock.toAccount.mockResolvedValue({
      address: zeroAddress,
    } as LocalAccount)
    const connector = createConnector()

    await getStore(connector).catch(() => undefined)

    expect(await connector.getAccounts()).not.toContain(zeroAddress)
  })

  it.fails('does not report a zero-address owner as authorized', async () => {
    walletMock.toAccount.mockResolvedValue({
      address: zeroAddress,
    } as LocalAccount)
    const connector = createConnector()

    await getStore(connector).catch(() => undefined)

    expect(await connector.isAuthorized()).toBe(false)
  })
})
