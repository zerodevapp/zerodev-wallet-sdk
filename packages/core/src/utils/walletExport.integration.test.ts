/**
 * Boundary: Wallet Core <-> the Turnkey DIRECT API (B2).
 *
 * `exportWallet` and `exportPrivateKey` bypass `client/transports/rest.ts`
 * entirely and call `https://api.turnkey.com/public/v1/…` with raw `fetch` — so
 * none of the transport's behaviour applies: no timeout, no typed error, no
 * status preserved. What crosses this seam is key material, so a wrong answer
 * here is worse than a wrong address.
 *
 * The two siblings disagree with each other, and that is the argument running
 * through this file: `exportPrivateKey` reports `<status> <body>` and dumps the
 * response when a bundle is missing, while `exportWallet` throws bare strings and
 * silently takes `wallets[0]`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ZeroDevWalletSDK } from '../core/createZeroDevWalletCore.js'
import { exportPrivateKey } from './exportPrivateKey.js'
import { exportWallet } from './exportWallet.js'

const ADDRESS = `0x${'11'.repeat(20)}`
const TARGET_PUBLIC_KEY = 'target-public-key'

const WALLET_BUNDLE = {
  activity: { result: { exportWalletResult: { exportBundle: 'bundle-1' } } },
}
const ACCOUNT_BUNDLE = {
  activity: {
    result: { exportWalletAccountResult: { exportBundle: 'bundle-1' } },
  },
}

function walletDouble(): ZeroDevWalletSDK {
  return {
    getSession: async () => ({
      organizationId: 'suborg-1',
      stamperType: 'apiKey',
    }),
    toAccount: async () => ({ address: ADDRESS }),
    client: {
      apiKeyStamper: {
        stamp: async () => ({
          stampHeaderName: 'X-Stamp',
          stampHeaderValue: 'stamp',
        }),
      },
    },
  } as unknown as ZeroDevWalletSDK
}

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })

/** Routes by endpoint: `list_wallets` first, then the export submission. */
function respond(list: () => Response, submit: () => Response) {
  const fetchMock = vi.fn(async (url: string | URL | Request) =>
    String(url).includes('list_wallets') ? list() : submit(),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** A fix may surface the status in the message or on the error; either counts. */
const reportsStatus = (error: unknown, status: number) =>
  error instanceof Error &&
  (error.message.includes(String(status)) ||
    (error as { status?: number }).status === status)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('wallet export: the contract that must keep holding', () => {
  it('returns the export bundle for the wallet it listed', async () => {
    respond(
      () => json({ wallets: [{ walletId: 'wallet-A' }] }),
      () => json(WALLET_BUNDLE),
    )

    const result = await exportWallet({
      wallet: walletDouble(),
      targetPublicKey: TARGET_PUBLIC_KEY,
    })

    expect(result).toMatchObject({
      exportBundle: 'bundle-1',
      walletId: 'wallet-A',
      organizationId: 'suborg-1',
    })
  })

  it('returns the export bundle for a private key without listing wallets', async () => {
    const fetchMock = respond(
      () => json({}),
      () => json(ACCOUNT_BUNDLE),
    )

    const result = await exportPrivateKey({
      wallet: walletDouble(),
      targetPublicKey: TARGET_PUBLIC_KEY,
    })

    expect(result).toMatchObject({
      exportBundle: 'bundle-1',
      address: ADDRESS,
      organizationId: 'suborg-1',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports the status and body when a private-key export is refused', async () => {
    respond(
      () => json({}),
      () => new Response('rate limited', { status: 429 }),
    )

    await expect(
      exportPrivateKey({
        wallet: walletDouble(),
        targetPublicKey: TARGET_PUBLIC_KEY,
      }),
    ).rejects.toThrow(/429.*rate limited/)
  })

  it('reports a missing wallet export bundle attributably', async () => {
    respond(
      () => json({ wallets: [{ walletId: 'wallet-A' }] }),
      () => json({ activity: { result: {} } }),
    )

    await expect(
      exportWallet({
        wallet: walletDouble(),
        targetPublicKey: TARGET_PUBLIC_KEY,
      }),
    ).rejects.toThrow(/Export bundle not found/)
  })

  it('names the response when a private-key export bundle is missing', async () => {
    respond(
      () => json({}),
      () => json({ activity: { result: {} } }),
    )

    await expect(
      exportPrivateKey({
        wallet: walletDouble(),
        targetPublicKey: TARGET_PUBLIC_KEY,
      }),
    ).rejects.toThrow(/Export bundle not found in response: \{/)
  })
})

describe('wallet export: choosing which wallet to hand over', () => {
  it.fails(
    'does not export a wallet of its own choosing when Turnkey lists several',
    async () => {
      // Two wallets in the authenticated sub-org.
      //
      // Today: resolves, having exported `wallet-A` — the caller is handed key
      // material for a wallet they never named. Same shape as
      // `walletAddresses[0]` in the viem adapter, one severity up.
      const fetchMock = respond(
        () =>
          json({
            wallets: [{ walletId: 'wallet-A' }, { walletId: 'wallet-B' }],
          }),
        () => json(WALLET_BUNDLE),
      )

      await expect(
        exportWallet({
          wallet: walletDouble(),
          targetPublicKey: TARGET_PUBLIC_KEY,
        }),
      ).rejects.toThrow()

      // Nothing was exported: refusing must happen before the submission.
      expect(fetchMock).toHaveBeenCalledTimes(1)
    },
  )

  it.fails(
    'attributes an empty wallet list to the response rather than dereferencing it',
    async () => {
      // Today: `TypeError: Cannot read properties of undefined (reading
      // 'walletId')`.
      respond(
        () => json({ wallets: [] }),
        () => json(WALLET_BUNDLE),
      )

      const error = await exportWallet({
        wallet: walletDouble(),
        targetPublicKey: TARGET_PUBLIC_KEY,
      }).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(Error)
      expect(error).not.toBeInstanceOf(TypeError)
      expect((error as Error).message).toMatch(/wallet/i)
    },
  )

  it.fails(
    'attributes a missing wallet list to the response rather than dereferencing it',
    async () => {
      // Today: `TypeError: Cannot read properties of undefined (reading '0')`.
      // Separate from the empty-array case because a fix for one can miss it.
      respond(
        () => json({}),
        () => json(WALLET_BUNDLE),
      )

      const error = await exportWallet({
        wallet: walletDouble(),
        targetPublicKey: TARGET_PUBLIC_KEY,
      }).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(Error)
      expect(error).not.toBeInstanceOf(TypeError)
      expect((error as Error).message).toMatch(/wallet/i)
    },
  )
})

describe('wallet export: what a caller can tell about a failure', () => {
  it.fails('reports the status when listing wallets is throttled', async () => {
    // Today: bare `Error: Failed to list wallets` — the 429 is gone, so a caller
    // cannot tell a throttle from a rejection. `exportPrivateKey` gets this
    // right on the same kind of failure.
    respond(
      () => new Response('rate limited', { status: 429 }),
      () => json(WALLET_BUNDLE),
    )

    const error = await exportWallet({
      wallet: walletDouble(),
      targetPublicKey: TARGET_PUBLIC_KEY,
    }).catch((e: unknown) => e)

    expect(reportsStatus(error, 429)).toBe(true)
  })

  it.fails(
    'reports the status when the export submission is rejected',
    async () => {
      // Today: bare `Error: Failed to export wallet`.
      respond(
        () => json({ wallets: [{ walletId: 'wallet-A' }] }),
        () => new Response('unauthorized', { status: 401 }),
      )

      const error = await exportWallet({
        wallet: walletDouble(),
        targetPublicKey: TARGET_PUBLIC_KEY,
      }).catch((e: unknown) => e)

      expect(reportsStatus(error, 401)).toBe(true)
    },
  )

  it.fails(
    'attributes a non-JSON export response to the wallet export',
    async () => {
      // A 200 carrying HTML, as a gateway interstitial would. Today
      // `response.json()` throws `SyntaxError: Unexpected token '<'` — neither
      // sibling checks content-type, where `rest.ts` checks and falls back to
      // text.
      respond(
        () => json({ wallets: [{ walletId: 'wallet-A' }] }),
        () =>
          new Response('<html>gateway</html>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          }),
      )

      const error = await exportWallet({
        wallet: walletDouble(),
        targetPublicKey: TARGET_PUBLIC_KEY,
      }).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(Error)
      expect(error).not.toBeInstanceOf(SyntaxError)
      expect((error as Error).message).toMatch(/export/i)
    },
  )

  it.fails(
    'attributes a non-JSON private-key export response to the export',
    async () => {
      // Its own case: the two siblings parse separate responses, so a fix to one
      // can leave the other behind.
      respond(
        () => json({}),
        () =>
          new Response('<html>gateway</html>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          }),
      )

      const error = await exportPrivateKey({
        wallet: walletDouble(),
        targetPublicKey: TARGET_PUBLIC_KEY,
      }).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(Error)
      expect(error).not.toBeInstanceOf(SyntaxError)
      expect((error as Error).message).toMatch(/export/i)
    },
  )

  it.fails('does not wait forever on an unanswered export', async () => {
    // A fetch that never settles, with fake timers so the clock is advanced
    // rather than waited on. Neither export helper passes an abort signal, where
    // `rest.ts` aborts a KMS call after 10 s.
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    )

    let settled = false
    // Deliberately not awaited — awaiting a request with no timeout IS the hang
    // under test.
    const pending = exportWallet({
      wallet: walletDouble(),
      targetPublicKey: TARGET_PUBLIC_KEY,
    }).then(
      () => {
        settled = true
      },
      () => {
        settled = true
      },
    )

    await vi.advanceTimersByTimeAsync(60_000)

    expect(pending).toBeInstanceOf(Promise)
    expect(settled).toBe(true)
  })
})
