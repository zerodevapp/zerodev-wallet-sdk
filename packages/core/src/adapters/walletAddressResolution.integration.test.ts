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
import { type Hex, isAddressEqual, recoverMessageAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it, vi } from 'vitest'
import type { ZeroDevWalletClient } from '../client/index.js'
import { toViemAccount } from './viem.js'

/** Real keys, so an account built on either address can actually sign:
 *  `toViemAccount` rejects any signature that does not recover to its wallet. */
const OWNER_A = privateKeyToAccount(`0x${'11'.repeat(32)}` as Hex)
const OWNER_B = privateKeyToAccount(`0x${'22'.repeat(32)}` as Hex)
const ADDR_A = OWNER_A.address
const ADDR_B = OWNER_B.address
const ZERO = '0x0000000000000000000000000000000000000000' as Hex

/** A client whose only job is to answer `getUserWallet` however we want, and to
 *  sign with whichever owner the caller names. */
function clientReturning(...responses: { walletAddresses: Hex[] }[]) {
  const getUserWallet = vi.fn(async () => {
    const next = responses.length > 1 ? responses.shift() : responses[0]
    return next as { walletAddresses: Hex[] }
  })
  const signMessage = vi.fn(
    async ({ address, message }: { address: Hex; message: string }) => {
      const owner = [OWNER_A, OWNER_B].find((o) =>
        isAddressEqual(o.address, address),
      )
      if (!owner) throw new Error(`No key for ${address}`)
      return owner.signMessage({ message })
    },
  )
  return {
    client: { getUserWallet, signMessage } as unknown as ZeroDevWalletClient,
    getUserWallet,
    signMessage,
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

  it.todo(
    'rejects a missing `walletAddresses` field with a diagnosable error, not a TypeError',
    async () => {
      // Today: `TypeError: Cannot read properties of undefined (reading '0')`.
      const error = await shapeViolation({}).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(Error)
      expect(error).not.toBeInstanceOf(TypeError)
      expect((error as Error).message).toMatch(/wallet/i)
    },
  )

  it.todo(
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

  it.todo(
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
  it('drops the second address, and that dropped entry is a wallet that signs', async () => {
    // The ambiguity itself: KMS answers with BOTH, `toViemAccount` takes `[0]`.
    const both = clientReturning({ walletAddresses: [ADDR_A, ADDR_B] })
    const chosen = await buildAccount(both.client)
    expect(chosen.address).toBe(ADDR_A)

    const b = clientReturning({ walletAddresses: [ADDR_B] })
    const dropped = await buildAccount(b.client)

    expect(dropped.address).toBe(ADDR_B)
    expect(dropped.type).toBe('local')
    const signature = await dropped.signMessage({ message: 'hello' })
    await expect(
      recoverMessageAddress({ message: 'hello', signature }),
    ).resolves.toBe(ADDR_B)
    expect(b.signMessage).toHaveBeenCalledWith(
      expect.objectContaining({ address: ADDR_B }),
    )
  })

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
