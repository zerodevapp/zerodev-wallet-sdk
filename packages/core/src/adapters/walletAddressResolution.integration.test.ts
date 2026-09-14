/**
 * Boundary: Wallet Core to KMS, at the point where a KMS response becomes the
 * address a user's funds go to (`toViemAccount` in `adapters/viem.ts`).
 *
 * The boundary with the most at stake in the SDK. The failure shape it guards
 * against is a degenerate KMS answer becoming a wrong address that the SDK then
 * uses without complaint. The zero, malformed and missing address guards are
 * asserted here as regression cover, and the rest of the file looks for what
 * those guards do NOT catch.
 *
 * `walletAddresses` is a plural `Hex[]`, and `getUserWallet`'s own docstring
 * shows two entries, but `toViemAccount` takes `[0]`.
 */
import type { Hex } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import type { ZeroDevWalletClient } from '../client/index.js'
import { toViemAccount } from './viem.js'

const ADDR_A = '0x1111111111111111111111111111111111111111' as Hex
const ADDR_B = '0x2222222222222222222222222222222222222222' as Hex
const ZERO = '0x0000000000000000000000000000000000000000' as Hex

/** A client whose only job is to answer `getUserWallet` however we want. */
function clientReturning(...responses: { walletAddresses: Hex[] }[]) {
  const getUserWallet = vi.fn(async () => {
    const next = responses.length > 1 ? responses.shift() : responses[0]
    return next as { walletAddresses: Hex[] }
  })
  return {
    client: { getUserWallet } as unknown as ZeroDevWalletClient,
    getUserWallet,
  }
}

function buildAccount(client: ZeroDevWalletClient) {
  return toViemAccount({
    client,
    organizationId: 'org-1',
    projectId: 'project-1',
    getToken: () => 'session-token',
  })
}

describe('wallet address resolution: guards that must hold (#365 regression)', () => {
  it('builds an account on the address KMS returns', async () => {
    const { client } = clientReturning({ walletAddresses: [ADDR_A] })

    const account = await buildAccount(client)

    expect(account.address).toBe(ADDR_A)
  })

  it('refuses to build an account when KMS returns no address', async () => {
    const { client } = clientReturning({ walletAddresses: [] })

    await expect(buildAccount(client)).rejects.toThrow(
      /missing, malformed, or zero/,
    )
  })

  it('refuses the zero address', async () => {
    const { client } = clientReturning({ walletAddresses: [ZERO] })

    await expect(buildAccount(client)).rejects.toThrow(
      /missing, malformed, or zero/,
    )
  })

  it('refuses a malformed address rather than passing it downstream', async () => {
    const { client } = clientReturning({
      walletAddresses: ['0xdeadbeef' as Hex],
    })

    await expect(buildAccount(client)).rejects.toThrow(
      /missing, malformed, or zero/,
    )
  })

  it("refuses the backend's wallet-fallback placeholder", async () => {
    // Not a hypothetical value: doorway-kms answers a failed `/user-wallet`
    // with HTTP 200 and this exact placeholder (40 Z's), which it publishes for
    // tests to assert against.
    const { client } = clientReturning({
      walletAddresses: ['0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ' as Hex],
    })

    await expect(buildAccount(client)).rejects.toThrow(
      /missing, malformed, or zero/,
    )
  })
})

describe('wallet address resolution: the response shape itself', () => {
  // The transport hands back `data as any` with no schema validation, so these
  // point wrong shapes at the seam. Each asserts the invariant every remedy
  // shares — the rejection must be attributable to the wallet response — rather
  // than a specific error type or message.

  const shapeViolation = (response: unknown) =>
    toViemAccount({
      client: {
        getUserWallet: vi.fn(async () => response),
      } as unknown as ZeroDevWalletClient,
      organizationId: 'org-1',
      projectId: 'project-1',
      getToken: () => 'session-token',
    })

  it('rejects a non-array `walletAddresses` with a diagnosable error', async () => {
    // A string slips through indexing (`"0x…"[0]` is `"0"`) and lands on the
    // address guard, so this already behaves.
    await expect(shapeViolation({ walletAddresses: ADDR_A })).rejects.toThrow(
      /missing, malformed, or zero/,
    )
  })

  it('rejects entries that are not strings with a diagnosable error', async () => {
    await expect(shapeViolation({ walletAddresses: [42] })).rejects.toThrow(
      /missing, malformed, or zero/,
    )
  })

  it.fails(
    'rejects a missing `walletAddresses` field with a diagnosable error, not a TypeError',
    async () => {
      // Today: `TypeError: Cannot read properties of undefined (reading '0')`.
      const error = await shapeViolation({}).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(Error)
      expect(error).not.toBeInstanceOf(TypeError)
      expect((error as Error).message).toMatch(/wallet/i)
    },
  )

  it.fails(
    'rejects a null `walletAddresses` with a diagnosable error, not a TypeError',
    async () => {
      // Today: `TypeError: Cannot read properties of null (reading '0')`.
      const error = await shapeViolation({ walletAddresses: null }).catch(
        (e: unknown) => e,
      )

      expect(error).toBeInstanceOf(Error)
      expect(error).not.toBeInstanceOf(TypeError)
      expect((error as Error).message).toMatch(/wallet/i)
    },
  )

  it.fails(
    'rejects an empty response body with a diagnosable error, not a TypeError',
    async () => {
      // Today: `TypeError: … of null (reading 'walletAddresses')`. Reachable on
      // any 200 with no body — the transport parses that to `null`.
      const error = await shapeViolation(null).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(Error)
      expect(error).not.toBeInstanceOf(TypeError)
      expect((error as Error).message).toMatch(/wallet/i)
    },
  )
})

describe('wallet address resolution: ambiguity a user can actually hit', () => {
  it('builds a fully usable account for EITHER address, so a dropped entry is a real wallet', async () => {
    const accountA = await buildAccount(
      clientReturning({ walletAddresses: [ADDR_A] }).client,
    )
    const accountB = await buildAccount(
      clientReturning({ walletAddresses: [ADDR_B] }).client,
    )

    expect(accountA.address).toBe(ADDR_A)
    expect(accountB.address).toBe(ADDR_B)
    expect(accountA.address).not.toBe(accountB.address)
    for (const account of [accountA, accountB]) {
      expect(account.type).toBe('local')
      expect(typeof account.signMessage).toBe('function')
      expect(typeof account.signTransaction).toBe('function')
      expect(typeof account.signTypedData).toBe('function')
    }
  })

  it.fails(
    'refuses to build an account when KMS returns more than one address',
    async () => {
      // Today `walletAddresses[0]` wins silently — a well-formed address, so the
      // validity guards above cannot catch it. Nothing here pins WHICH entry is
      // chosen: mutating the adapter to take the last element leaves the suite
      // green, deliberately.
      const { client } = clientReturning({
        walletAddresses: [ADDR_A, ADDR_B],
      })

      await expect(buildAccount(client)).rejects.toThrow()
    },
  )

  it('reflects a changed wallet address rather than reusing the first answer', async () => {
    // The double answers with a DIFFERENT address on the second call, so a
    // cache that still calls and ignores the answer fails here too.
    const { client, getUserWallet } = clientReturning(
      { walletAddresses: [ADDR_A] },
      { walletAddresses: [ADDR_B] },
    )

    const before = await buildAccount(client)
    const after = await buildAccount(client)

    expect(before.address).toBe(ADDR_A)
    expect(after.address).toBe(ADDR_B)
    expect(getUserWallet).toHaveBeenCalledTimes(2)
  })

  it('propagates a KMS failure instead of producing an account', async () => {
    const client = {
      getUserWallet: vi.fn(async () => {
        throw new Error('KMS unavailable')
      }),
    } as unknown as ZeroDevWalletClient

    await expect(buildAccount(client)).rejects.toThrow(/KMS unavailable/)
  })
})
