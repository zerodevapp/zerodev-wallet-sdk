import type {
  ZeroDevWalletSDK,
  ZeroDevWalletSession,
} from '@zerodev/wallet-core'
import type { LocalAccount } from 'viem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sepolia } from 'wagmi/chains'
import { createProvider } from './provider.js'
import { createZeroDevWalletStore } from './store.js'

/**
 * Session auto-refresh — `scheduleSessionRefresh` / `refreshSessionNow`.
 *
 * `provider.test.ts` covers the JSON-RPC surface (`wallet_sendCalls`,
 * `wallet_getCallsStatus`, `wallet_getCapabilities`) and nothing else, so this
 * scheduling logic has had no coverage at any layer despite deciding when a
 * user silently loses their session.
 *
 * SOME TESTS HERE ARE MARKED `it.fails()`. They document live defects; they are
 * not broken tests. `it.fails()` asserts the body still fails, so the suite is
 * green while the bug exists and turns RED the moment someone fixes it — at
 * which point change them back to plain `it()`.
 *
 * The assertion bodies are UNCHANGED and still state intended behaviour. Note
 * `it.fails()` passes if the body throws for any reason, so it is a weaker
 * signal than a genuinely red test; the passing tests in this file are the
 * control that catches a broken fixture.
 */

const BASE_TIME = 1_700_000_000_000
const MINUTE = 60_000
const DEFAULT_THRESHOLD = MINUTE
const EOA_ADDRESS = '0xeoa000000000000000000000000000000000abcd'

const refreshSessionMock = vi.fn()

/** Expiry is stored in ms by the passkey flows; `normalizeTimestamp` passes it through. */
function session(
  overrides: Partial<ZeroDevWalletSession> = {},
): ZeroDevWalletSession {
  return {
    id: 'session_indexedDb_1',
    userId: 'user-1',
    organizationId: 'org-1',
    stamperType: 'apiKey',
    token: 'jwt-token',
    expiry: BASE_TIME + 15 * MINUTE,
    createdAt: BASE_TIME,
    ...overrides,
  }
}

function setup(
  opts: {
    session?: ZeroDevWalletSession | null
    autoRefreshSession?: boolean
    sessionWarningThreshold?: number
  } = {},
) {
  const store = createZeroDevWalletStore()
  store.getState().setActiveChainId(sepolia.id)
  store.getState().setEoaAccount({ address: EOA_ADDRESS } as LocalAccount)
  store.getState().setWallet({
    refreshSession: refreshSessionMock,
  } as unknown as ZeroDevWalletSDK)

  // Seeded before the provider exists so construction sees it, mirroring a
  // page load that restores a persisted session.
  if (opts.session !== undefined) store.getState().setSession(opts.session)

  const provider = createProvider({
    store,
    config: {
      projectId: 'proj-test',
      chains: [sepolia],
      ...(opts.autoRefreshSession !== undefined && {
        autoRefreshSession: opts.autoRefreshSession,
      }),
      ...(opts.sessionWarningThreshold !== undefined && {
        sessionWarningThreshold: opts.sessionWarningThreshold,
      }),
    },
    chains: [sepolia],
  })

  return { store, provider }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(BASE_TIME)
  refreshSessionMock.mockReset()
  refreshSessionMock.mockResolvedValue(
    session({ id: 'session_indexedDb_2', expiry: BASE_TIME + 30 * MINUTE }),
  )
})

afterEach(() => {
  vi.useRealTimers()
})

describe('session auto-refresh scheduling', () => {
  it('refreshes one minute before expiry, not at expiry', async () => {
    const { provider } = setup({ session: session() })

    // One millisecond before the scheduled moment nothing should have fired.
    await vi.advanceTimersByTimeAsync(15 * MINUTE - DEFAULT_THRESHOLD - 1)
    expect(refreshSessionMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(refreshSessionMock).toHaveBeenCalledOnce()

    provider.destroy()
  })

  it('refreshes the active session by id', async () => {
    const { provider } = setup({ session: session({ id: 'session_otp_7' }) })

    await vi.advanceTimersByTimeAsync(15 * MINUTE - DEFAULT_THRESHOLD)

    expect(refreshSessionMock).toHaveBeenCalledWith('session_otp_7')
    provider.destroy()
  })

  it('stores the refreshed session and re-arms for the next cycle', async () => {
    const { store, provider } = setup({ session: session() })

    await vi.advanceTimersByTimeAsync(15 * MINUTE - DEFAULT_THRESHOLD)
    expect(store.getState().session?.id).toBe('session_indexedDb_2')

    // The replacement expires at BASE_TIME + 30m, so its own refresh is due
    // 60s before that. Without re-arming, the session would lapse silently.
    refreshSessionMock.mockResolvedValue(
      session({ id: 'session_indexedDb_3', expiry: BASE_TIME + 45 * MINUTE }),
    )
    await vi.advanceTimersByTimeAsync(15 * MINUTE)
    expect(refreshSessionMock).toHaveBeenCalledTimes(2)
    expect(store.getState().session?.id).toBe('session_indexedDb_3')

    provider.destroy()
  })

  it('refreshes exactly once per expiry window', async () => {
    // `setSession` notifies a store subscriber that also schedules, and the
    // success path schedules again explicitly. Double-arming would refresh
    // twice per window and burn a key rotation each time.
    const { provider } = setup({ session: session() })

    await vi.advanceTimersByTimeAsync(15 * MINUTE - DEFAULT_THRESHOLD)

    expect(refreshSessionMock).toHaveBeenCalledOnce()
    provider.destroy()
  })

  it('clears the session when the refresh fails so the app can re-authenticate', async () => {
    refreshSessionMock.mockRejectedValue(new Error('KMS unavailable'))
    const { store, provider } = setup({ session: session() })

    await vi.advanceTimersByTimeAsync(15 * MINUTE - DEFAULT_THRESHOLD)

    expect(store.getState().session).toBeNull()
    expect(store.getState().isExpiring).toBe(false)
    provider.destroy()
  })

  it('drops an already-expired session without calling the backend', async () => {
    // DPL-662: a tab backgrounded across expiry must not hammer the KMS with
    // a key the backend has already retired.
    const { store, provider } = setup({
      session: session({ expiry: BASE_TIME - MINUTE }),
    })

    await vi.advanceTimersByTimeAsync(0)

    expect(refreshSessionMock).not.toHaveBeenCalled()
    expect(store.getState().session).toBeNull()
    provider.destroy()
  })

  it('refreshes immediately when the session is already inside the warning window', async () => {
    // 30s of life left against a 60s threshold: the refresh moment is already
    // past, so waiting would mean scheduling a negative timeout.
    const { provider } = setup({
      session: session({ expiry: BASE_TIME + 30_000 }),
    })

    await vi.advanceTimersByTimeAsync(0)

    expect(refreshSessionMock).toHaveBeenCalledOnce()
    provider.destroy()
  })

  it('honours a custom sessionWarningThreshold', async () => {
    const { provider } = setup({
      session: session(),
      sessionWarningThreshold: 5 * MINUTE,
    })

    await vi.advanceTimersByTimeAsync(10 * MINUTE - 1)
    expect(refreshSessionMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(refreshSessionMock).toHaveBeenCalledOnce()

    provider.destroy()
  })

  it.fails(
    'treats sessionWarningThreshold: 0 as "refresh at expiry", not as unset',
    async () => {
      // A consumer passing 0 is asking for no early refresh. Collapsing 0 into
      // the 60s default is the same zero-is-falsy trap as an `expiry: 0` session
      // reading as "never expires" — a legitimate value silently discarded.
      const { provider } = setup({
        session: session(),
        sessionWarningThreshold: 0,
      })

      // With a 0 threshold the refresh is due at expiry (15m), so at 14m59.999s
      // — which is *inside* the default 60s window — nothing should have fired.
      await vi.advanceTimersByTimeAsync(15 * MINUTE - 1)
      expect(refreshSessionMock).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      expect(refreshSessionMock).toHaveBeenCalledOnce()

      provider.destroy()
    },
  )

  it('does not schedule anything when autoRefreshSession is false', async () => {
    const { store, provider } = setup({
      session: session(),
      autoRefreshSession: false,
    })

    await vi.advanceTimersByTimeAsync(20 * MINUTE)

    expect(refreshSessionMock).not.toHaveBeenCalled()
    // Opting out of refresh must not also mean opting out of the session.
    expect(store.getState().session).not.toBeNull()
    provider.destroy()
  })

  it('re-evaluates when the tab becomes visible after lapsing in the background', async () => {
    // DPL-662: setTimeout does not fire reliably in a suspended tab, so the
    // session can outlive its timer. Returning to the tab must notice.
    const { store, provider } = setup({ session: session() })

    // Clock moves past expiry WITHOUT running timers — a suspended tab.
    vi.setSystemTime(BASE_TIME + 20 * MINUTE)
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)

    expect(store.getState().session).toBeNull()
    expect(refreshSessionMock).not.toHaveBeenCalled()
    provider.destroy()
  })

  it('stops refreshing once the provider is destroyed', async () => {
    const { provider } = setup({ session: session() })

    provider.destroy()
    await vi.advanceTimersByTimeAsync(20 * MINUTE)

    expect(refreshSessionMock).not.toHaveBeenCalled()
  })
})
