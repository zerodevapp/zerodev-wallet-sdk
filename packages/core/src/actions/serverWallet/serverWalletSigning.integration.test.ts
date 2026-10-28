/**
 * Boundary: the server wallet client <-> the KMS, across all four sign routes.
 */
import {
  concat,
  type Hex,
  hashMessage,
  isAddressEqual,
  keccak256,
  numberToHex,
  parseGwei,
  recoverAddress,
  serializeTransaction,
  toRlp,
  zeroAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { hashAuthorization } from 'viem/utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createZeroDevServerWallet } from '../../server/createZeroDevServerWallet.js'

/** Publicly known test keys. OWNER is the wallet the KMS double signs as. */
const OWNER = privateKeyToAccount(`0x${'11'.repeat(32)}` as Hex)
const STRANGER = privateKeyToAccount(`0x${'22'.repeat(32)}` as Hex)

/** A valid P-256 scalar; the agent key the client stamps with. */
const AGENT_KEY = `0x${'33'.repeat(32)}`

const PROJECT = 'proj'
const ORG = 'wallet-set-sub-org'
const BASE_URL = 'https://kms.test.invalid/api/v1'

/** What a sign route is answered with. A degenerate case differs only in this. */
type Answer = { json: unknown } | { raw: string; contentType: string }

type Routes = { sign?: (payloadHash: string) => Promise<Answer> }

function respond(answer: Answer): Response {
  if ('raw' in answer) {
    return new Response(answer.raw, {
      status: 200,
      headers: { 'content-type': answer.contentType },
    })
  }
  return new Response(JSON.stringify(answer.json), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Builds a real server wallet over a stubbed KMS. The double dispatches on
 * route and decides nothing, so a degenerate case differs from the control only
 * in `answer`. Returns the fetch spy so a test can read the request that was
 * sent, or assert none was.
 */
function serverWalletAgainst(routes: Routes) {
  const fetchSpy = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url)
      const body = init?.body ? JSON.parse(String(init.body)) : {}

      if (path.includes('/server-wallet/sign/') && routes.sign) {
        return respond(
          await routes.sign(body.turnkeyPayload.parameters.payload),
        )
      }
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })
    },
  )
  vi.stubGlobal('fetch', fetchSpy)

  const wallet = createZeroDevServerWallet({
    projectId: PROJECT,
    organizationId: ORG,
    privateKey: AGENT_KEY,
    proxyBaseUrl: BASE_URL,
  })
  return { wallet, fetchSpy }
}

type Wallet = ReturnType<typeof serverWalletAgainst>['wallet']

type Outcome = { returned: unknown } | { threw: unknown }

const caught = (p: Promise<unknown>): Promise<Outcome> =>
  p.then(
    (returned) => ({ returned }),
    (threw: unknown) => ({ threw }),
  )

/**
 * Attributable = the caller can tell the KMS response was at fault. Rejects a
 * `TypeError` and a message naming nothing, so neither a raw dereference nor a
 * bare `Error('failed')` passes for a guard.
 */
function blamesTheResponse(outcome: Outcome): boolean {
  if (!('threw' in outcome)) return false
  const error = outcome.threw
  return (
    error instanceof Error &&
    !(error instanceof TypeError) &&
    /address|wallet|response/i.test(error.message)
  )
}

/**
 * The caller-input counterpart: no response exists, so the error must name what
 * the caller passed. Kept separate from `blamesTheResponse` because conflating
 * the two hides which side was at fault.
 */
function blamesTheInput(outcome: Outcome, naming: RegExp): boolean {
  if (!('threw' in outcome)) return false
  const error = outcome.threw
  return (
    error instanceof Error &&
    !(error instanceof TypeError) &&
    naming.test(error.message)
  )
}

/**
 * The asserted wiring the docblocks claim: the exact route, the agent stamp header
 * the KMS reads, and no session token.
 */
function assertServerWiring(
  fetchSpy: ReturnType<typeof serverWalletAgainst>['fetchSpy'],
  route: string,
): void {
  const [url, init] = fetchSpy.mock.calls[0] ?? []
  expect(String(url)).toBe(`${BASE_URL}/${PROJECT}/server-wallet/sign/${route}`)
  const headers = init?.headers as Record<string, string>
  expect(headers['X-Agent-Stamp']).toBeTruthy()
  expect(headers.Authorization).toBeUndefined()
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('signMessage: the server client reaches the shared signing guards', () => {
  it('asks the KMS to sign the message it was given, and returns a signature that recovers to the owner', async () => {
    const expectedHash = hashMessage('hello')
    const { wallet, fetchSpy } = serverWalletAgainst({
      sign: async (payloadHash) => ({
        json: { signature: await OWNER.sign({ hash: `0x${payloadHash}` }) },
      }),
    })

    const signature = await wallet.client.signMessage({
      projectId: PROJECT,
      address: OWNER.address,
      message: 'hello',
      encoding: 'utf8',
    })

    assertServerWiring(fetchSpy, 'message')

    const sent = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(`0x${sent.turnkeyPayload.parameters.payload}`).toBe(expectedHash)
    const recovered = await recoverAddress({
      hash: expectedHash,
      signature: signature as Hex,
    })
    expect(isAddressEqual(recovered, OWNER.address)).toBe(true)
  })

  it('refuses a well-formed signature made by a different key', async () => {
    const { wallet } = serverWalletAgainst({
      sign: async (payloadHash) => ({
        json: { signature: await STRANGER.sign({ hash: `0x${payloadHash}` }) },
      }),
    })

    const outcome = await caught(
      wallet.client.signMessage({
        projectId: PROJECT,
        address: OWNER.address,
        message: 'hello',
        encoding: 'utf8',
      }),
    )

    expect(blamesTheResponse(outcome)).toBe(true)
  })
})

describe('signMessage: addresses refused before the KMS is asked', () => {
  const refused: [string, Hex][] = [
    ['the zero address', zeroAddress],
    ['an address of the wrong length', '0xdeadbeef' as Hex],
    ['a value that is not hex at all', 'not-an-address' as Hex],
  ]

  for (const [label, address] of refused) {
    it(`refuses to stamp ${label}`, async () => {
      const { wallet, fetchSpy } = serverWalletAgainst({
        sign: async (payloadHash) => ({
          json: { signature: await OWNER.sign({ hash: `0x${payloadHash}` }) },
        }),
      })

      const outcome = await caught(
        wallet.client.signMessage({
          projectId: PROJECT,
          address,
          message: 'hello',
          encoding: 'utf8',
        }),
      )

      expect(blamesTheInput(outcome, /invalid or zero address/i)).toBe(true)
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  }
})

describe('a caller-supplied hash that is not 32 bytes', () => {
  const routes: [string, (w: Wallet) => Promise<Hex>][] = [
    [
      'signTypedDataV4',
      (w) =>
        w.client.signTypedDataV4({
          projectId: PROJECT,
          address: OWNER.address,
          unsignedTypedDataV4: '{}',
          encoding: 'utf8',
          typedDataHash: 'deadbeef',
        }),
    ],
    [
      'sign7702Authorization',
      (w) =>
        w.client.sign7702Authorization({
          projectId: PROJECT,
          address: OWNER.address,
          unsignedTransaction: 'deadbeef',
          hashedAuthorization: 'deadbeef',
        }),
    ],
  ]

  for (const [name, run] of routes) {
    it(`${name}: refuses to stamp it, without asking the KMS`, async () => {
      const { wallet, fetchSpy } = serverWalletAgainst({
        sign: async (payloadHash) => ({
          json: { signature: await OWNER.sign({ hash: `0x${payloadHash}` }) },
        }),
      })

      const outcome = await caught(run(wallet))

      expect(blamesTheInput(outcome, /not a 32-byte hex hash/i)).toBe(true)
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  }
})

describe('signTransaction and sign7702Authorization: the server client reaches the shared guards', () => {
  const TX = serializeTransaction({
    chainId: 1,
    to: `0x${'22'.repeat(20)}`,
    value: 0n,
    nonce: 0,
    gas: 21_000n,
    maxFeePerGas: parseGwei('1'),
    maxPriorityFeePerGas: parseGwei('1'),
    type: 'eip1559',
  }).slice(2)

  const AUTHORIZATION = {
    address: `0x${'22'.repeat(20)}` as Hex,
    chainId: 421614,
    nonce: 0,
  }
  const UNSIGNED_AUTHORIZATION = concat([
    '0x05',
    toRlp([numberToHex(AUTHORIZATION.chainId), AUTHORIZATION.address, '0x']),
  ]).slice(2)
  const AUTH_HASH = hashAuthorization(AUTHORIZATION)

  const routes: [string, (w: Wallet) => Promise<Hex>, Hex, string][] = [
    [
      'signTransaction',
      (w) =>
        w.client.signTransaction({
          projectId: PROJECT,
          address: OWNER.address,
          unsignedTransaction: TX,
        }),
      keccak256(`0x${TX}`),
      'transaction',
    ],
    [
      'sign7702Authorization',
      (w) =>
        w.client.sign7702Authorization({
          projectId: PROJECT,
          address: OWNER.address,
          unsignedTransaction: UNSIGNED_AUTHORIZATION,
          hashedAuthorization: AUTH_HASH.slice(2),
        }),
      AUTH_HASH,
      '7702-authorization',
    ],
  ]

  for (const [name, run, expectedHash, route] of routes) {
    it(`${name}: asks for the digest it should, and returns a signature that recovers to the owner`, async () => {
      const { wallet, fetchSpy } = serverWalletAgainst({
        sign: async (payloadHash) => ({
          json: { signature: await OWNER.sign({ hash: `0x${payloadHash}` }) },
        }),
      })

      const signature = await run(wallet)

      assertServerWiring(fetchSpy, route)
      const sent = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
      expect(`0x${sent.turnkeyPayload.parameters.payload}`).toBe(expectedHash)
      const recovered = await recoverAddress({
        hash: expectedHash,
        signature,
      })
      expect(isAddressEqual(recovered, OWNER.address)).toBe(true)
    })

    it(`${name}: refuses a well-formed signature made by a different key`, async () => {
      const { wallet } = serverWalletAgainst({
        sign: async (payloadHash) => ({
          json: {
            signature: await STRANGER.sign({ hash: `0x${payloadHash}` }),
          },
        }),
      })

      expect(blamesTheResponse(await caught(run(wallet)))).toBe(true)
    })
  }
})

describe('signTransaction: transaction bytes that are not a transaction', () => {
  const unusable: [string, string][] = [
    ['the bytes are not hex', 'zzzz'],
    ['the bytes are empty', ''],
  ]

  for (const [label, unsignedTransaction] of unusable) {
    it.fails(`refuses to sign when ${label}`, async () => {
      const { wallet, fetchSpy } = serverWalletAgainst({
        sign: async (payloadHash) => ({
          json: { signature: await OWNER.sign({ hash: `0x${payloadHash}` }) },
        }),
      })

      const outcome = await caught(
        wallet.client.signTransaction({
          projectId: PROJECT,
          address: OWNER.address,
          unsignedTransaction,
        }),
      )

      expect(blamesTheInput(outcome, /transaction|bytes|hex/i)).toBe(true)
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  }
})
