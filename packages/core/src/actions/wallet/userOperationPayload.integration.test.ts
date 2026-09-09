/**
 * Boundary between Wallet Core and KMS.
 *
 * Nothing in Core or the viem adapter calls `sign/user-operation`. Only an app
 * using the client gets there, so the test calls the action directly.
 * `computeDataPayloadHash` is specific to this endpoint. `sendSigningRequest`
 * and `buildTurnkeyPayload`'s address guard are shared with the other signing
 * paths.
 */
import { type Hex, keccak256, recoverAddress, toHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { rest } from '../../client/transports/rest.js'
import type { Client } from '../../client/types.js'
import type { Stamper } from '../../stampers/types.js'
import { signUserOperation } from './signUserOperation.js'

const BASE = 'https://kms.example.invalid/api/v1'
const SIGN_URL = `${BASE}/proj/sign/user-operation`

/** Publicly known test keys. OWNER is the wallet; IMPOSTOR is anyone else. */
const OWNER = privateKeyToAccount(`0x${'11'.repeat(32)}` as Hex)
const IMPOSTOR = privateKeyToAccount(`0x${'33'.repeat(32)}` as Hex)

/** A plausible packed user operation. Content is opaque to Core. */
const USER_OP = '0xdeadbeef'

const stamper: Stamper = {
  stamp: async () => ({
    stampHeaderName: 'X-Stamp',
    stampHeaderValue: 'stamp',
  }),
  clear: async () => {},
}

type SigningRequest = {
  unsignedUserOperation: string
  chainId: number
  encoding: string
  turnkeyPayload: { parameters: { signWith: string; payload: string } }
}

function driven(
  answer?: (correct: Hex) => unknown,
  signer = OWNER,
): { client: Client; sent: SigningRequest[]; urls: string[] } {
  const sent: SigningRequest[] = []
  const urls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      urls.push(String(url))
      const body = JSON.parse(String(init?.body)) as SigningRequest
      sent.push(body)
      const correct = await signer.sign({
        hash: `0x${body.turnkeyPayload.parameters.payload}` as Hex,
      })
      return new Response(
        JSON.stringify(answer ? answer(correct) : { signature: correct }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }),
  )
  const client = {
    request: rest(BASE, {
      apiKeyStamper: stamper,
      passkeyStamper: stamper,
    }).request,
    apiKeyStamper: stamper,
  } as unknown as Client

  return { client, sent, urls }
}

const PARAMS = {
  organizationId: 'suborg-1',
  projectId: 'proj',
  token: 'tok',
  address: OWNER.address,
  chainId: 1,
  encoding: 'hex' as const,
  unsignedUserOperation: USER_OP,
}

const outcomeOf = (p: Promise<unknown>) =>
  p.then(
    (value) => ({ ok: true, value }) as const,
    (error: unknown) => ({ ok: false, error }) as const,
  )

/** 65 bytes exactly. Asserted alongside recovery, never instead of it. */
const SIGNATURE = /^0x[0-9a-f]{130}$/i

/** Attributable = an Error that is not a raw deref and names the signature. */
const blamesTheSignature = (error: unknown) =>
  error instanceof Error &&
  !(error instanceof TypeError) &&
  /signature|signing|owner/i.test(error.message)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('user operation: a signature the caller can broadcast', () => {
  const encodings: ['hex' | 'utf8', string, Hex][] = [
    ['hex', 'the bytes the hex decodes to', keccak256(USER_OP)],
    ['utf8', 'the bytes of the string itself', keccak256(toHex(USER_OP))],
  ]

  for (const [encoding, what, expected] of encodings) {
    it(`signs ${what} when the encoding is ${encoding}`, async () => {
      const { client } = driven()

      const signature = await signUserOperation(client, { ...PARAMS, encoding })

      expect(signature).toMatch(SIGNATURE)
      await expect(recoverAddress({ hash: expected, signature })).resolves.toBe(
        OWNER.address,
      )
    })
  }

  it('hashes the user operation the caller passed, not something else', async () => {
    const { client, sent } = driven()

    await signUserOperation(client, { ...PARAMS, encoding: 'hex' })

    expect(`0x${sent[0].turnkeyPayload.parameters.payload}`).toBe(
      keccak256(USER_OP),
    )
  })

  it('hashes the raw string when the encoding is utf8', async () => {
    const { client, sent } = driven()

    await signUserOperation(client, { ...PARAMS, encoding: 'utf8' })

    expect(`0x${sent[0].turnkeyPayload.parameters.payload}`).toBe(
      keccak256(toHex(USER_OP)),
    )
  })

  it('sends the operation, chain and encoding on to the backend', async () => {
    const { client, sent, urls } = driven()

    await signUserOperation(client, { ...PARAMS, chainId: 8453 })

    expect(urls).toEqual([SIGN_URL])
    expect(sent[0]).toMatchObject({
      unsignedUserOperation: USER_OP,
      chainId: 8453,
      encoding: 'hex',
    })
    expect(sent[0].turnkeyPayload.parameters.signWith).toBe(OWNER.address)
  })
})

describe('user operation: refusing before a round trip is spent', () => {
  const badAddresses: [string, Hex][] = [
    ['the zero address', `0x${'00'.repeat(20)}` as Hex],
    ['a malformed address', '0xdead' as Hex],
  ]

  for (const [label, address] of badAddresses) {
    it(`refuses ${label} without asking KMS`, async () => {
      const { client, urls } = driven()

      const outcome = await outcomeOf(
        signUserOperation(client, { ...PARAMS, address }),
      )

      expect(outcome.ok).toBe(false)
      expect(urls).toHaveLength(0)
    })
  }
})

describe('user operation: the signing response is unusable', () => {
  const unusable: [string, (correct: Hex) => unknown][] = [
    ['the field is absent', () => ({})],
    ['it is an empty string', () => ({ signature: '' })],
    ['it is null', () => ({ signature: null })],
    ['it is not a string', () => ({ signature: 42 })],
    ['it is truncated', (correct) => ({ signature: correct.slice(0, 40) })],
  ]

  for (const [label, answer] of unusable) {
    it(`returns no signature when ${label}`, async () => {
      const { client } = driven(answer)

      const outcome = await outcomeOf(signUserOperation(client, PARAMS))

      expect(outcome.ok).toBe(false)
      expect(blamesTheSignature((outcome as { error: unknown }).error)).toBe(
        true,
      )
    })
  }

  it('refuses a signature from a key that is not the wallet', async () => {
    const { client } = driven(undefined, IMPOSTOR)

    const outcome = await outcomeOf(signUserOperation(client, PARAMS))

    expect(outcome.ok).toBe(false)
    expect(blamesTheSignature((outcome as { error: unknown }).error)).toBe(true)
  })

  it('accepts a signature the backend sent without an 0x prefix', async () => {
    const { client } = driven((correct) => ({ signature: correct.slice(2) }))

    const signature = await signUserOperation(client, PARAMS)

    expect(signature).toMatch(SIGNATURE)
  })
})
