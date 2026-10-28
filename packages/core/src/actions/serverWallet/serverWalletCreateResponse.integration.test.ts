/**
 * Boundary: the server wallet client <-> the KMS, at the point a create
 * response becomes a wallet the caller will fund and derive from.
 */
import { type Hex, zeroAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createZeroDevServerWallet } from '../../server/createZeroDevServerWallet.js'

/** A publicly known test key; the wallet the KMS double names. */
const OWNER = privateKeyToAccount(`0x${'11'.repeat(32)}` as Hex)

/** A valid P-256 scalar; the agent key the client stamps with. */
const AGENT_KEY = `0x${'33'.repeat(32)}`

const PROJECT = 'proj'
const ORG = 'wallet-set-sub-org'
const BASE_URL = 'https://kms.test.invalid/api/v1'
const WALLET_ID = 'wallet-1'
const TURNKEY_ID = 'tk-1'
const FIRST_PATH = "m/44'/60'/0'/0/0"

/** What a route is answered with. A degenerate case differs only in this. */
type Answer =
  | { json: unknown }
  | { raw: string; contentType: string }
  | { failure: { status: number; body: unknown } }

type Routes = { wallets?: Answer; addresses?: Answer }

function respond(answer: Answer): Response {
  if ('failure' in answer) {
    return new Response(JSON.stringify(answer.failure.body), {
      status: answer.failure.status,
      headers: { 'content-type': 'application/json' },
    })
  }
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
  const fetchSpy = vi.fn(async (url: string | URL | Request) => {
    const path = String(url)
    if (path.endsWith('/server-wallet/wallets') && routes.wallets) {
      return respond(routes.wallets)
    }
    if (path.endsWith('/server-wallet/wallet-addresses') && routes.addresses) {
      return respond(routes.addresses)
    }
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchSpy)

  const wallet = createZeroDevServerWallet({
    projectId: PROJECT,
    organizationId: ORG,
    privateKey: AGENT_KEY,
    proxyBaseUrl: BASE_URL,
  })
  return { wallet, fetchSpy }
}

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
 * The degenerate body must actually have been delivered and consumed. Without
 * this, a marker clears on a request that never reached the route.
 */
function reached(
  fetchSpy: ReturnType<typeof serverWalletAgainst>['fetchSpy'],
  route: string,
): boolean {
  return (
    fetchSpy.mock.calls.length === 1 &&
    String(fetchSpy.mock.calls[0]?.[0]).endsWith(route)
  )
}

const WALLETS_ROUTE = '/server-wallet/wallets'
const ADDRESSES_ROUTE = '/server-wallet/wallet-addresses'

/** The exact body the double was told to answer with, so a control can compare. */
const createdWallet = {
  walletId: WALLET_ID,
  walletAddress: OWNER.address,
}

const derivedAddress = {
  walletId: WALLET_ID,
  turnkeyId: TURNKEY_ID,
  path: FIRST_PATH,
  walletAddress: OWNER.address,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createWallet: the control', () => {
  it('hands back exactly the wallet the KMS named', async () => {
    const { wallet } = serverWalletAgainst({
      wallets: { json: createdWallet },
    })

    const created = await wallet.createWallet()

    expect(created.walletAddress).toBe(createdWallet.walletAddress)
    expect(created.walletId).toBe(WALLET_ID)
  })
})

describe('createWallet: a body that cannot produce a usable wallet', () => {
  const unusable: [string, unknown][] = [
    ['the body is empty', {}],
    ['the address is null', { walletId: WALLET_ID, walletAddress: null }],
    ['the address is absent', { walletId: WALLET_ID }],
    [
      'the address is not an address',
      { walletId: WALLET_ID, walletAddress: 'not-an-address' },
    ],
    [
      'the address is the zero address',
      { walletId: WALLET_ID, walletAddress: zeroAddress },
    ],
    ['the wallet id is null', { walletId: null, walletAddress: OWNER.address }],
    ['the wallet id is empty', { walletId: '', walletAddress: OWNER.address }],
  ]

  for (const [label, json] of unusable) {
    it.fails(`refuses to return a wallet when ${label}`, async () => {
      const { wallet, fetchSpy } = serverWalletAgainst({ wallets: { json } })

      const outcome = await caught(wallet.createWallet())

      expect(reached(fetchSpy, WALLETS_ROUTE)).toBe(true)
      expect(blamesTheResponse(outcome)).toBe(true)
    })
  }

  it.fails('refuses a 200 that is not JSON at all', async () => {
    const { wallet, fetchSpy } = serverWalletAgainst({
      wallets: { raw: '<html>gateway</html>', contentType: 'text/html' },
    })

    const outcome = await caught(wallet.createWallet())

    expect(reached(fetchSpy, WALLETS_ROUTE)).toBe(true)
    expect(blamesTheResponse(outcome)).toBe(true)
  })
})

describe('createAddress: the control', () => {
  it('hands back exactly the address the KMS derived, for the path asked for', async () => {
    const { wallet } = serverWalletAgainst({
      addresses: { json: derivedAddress },
    })

    const derived = await wallet.createAddress({
      walletId: WALLET_ID,
      path: FIRST_PATH,
    })

    expect(derived.walletAddress).toBe(derivedAddress.walletAddress)
    expect(derived.walletId).toBe(WALLET_ID)
    expect(derived.path).toBe(FIRST_PATH)
  })
})

/**
 * The same degenerate set as `createWallet`, because the guard is missing in
 * the same way and a fix that covers only the absent case would leave `null`,
 * a malformed string and the zero address still flowing to the caller.
 */
describe('createAddress: a body that cannot produce a usable address', () => {
  const unusable: [string, unknown][] = [
    [
      'the address is absent',
      { walletId: WALLET_ID, turnkeyId: TURNKEY_ID, path: FIRST_PATH },
    ],
    ['the address is null', { ...derivedAddress, walletAddress: null }],
    [
      'the address is not an address',
      { ...derivedAddress, walletAddress: 'not-an-address' },
    ],
    [
      'the address is the zero address',
      { ...derivedAddress, walletAddress: zeroAddress },
    ],
    ['the wallet id is absent', { ...derivedAddress, walletId: undefined }],
    ['the wallet id is empty', { ...derivedAddress, walletId: '' }],
    ['the turnkey id is absent', { ...derivedAddress, turnkeyId: undefined }],
    ['the turnkey id is empty', { ...derivedAddress, turnkeyId: '' }],
    ['the path is absent', { ...derivedAddress, path: undefined }],
    ['the path is empty', { ...derivedAddress, path: '' }],
  ]

  for (const [label, json] of unusable) {
    it.fails(`refuses to return an address when ${label}`, async () => {
      const { wallet, fetchSpy } = serverWalletAgainst({ addresses: { json } })

      const outcome = await caught(
        wallet.createAddress({ walletId: WALLET_ID, path: FIRST_PATH }),
      )

      expect(reached(fetchSpy, ADDRESSES_ROUTE)).toBe(true)
      expect(blamesTheResponse(outcome)).toBe(true)
    })
  }
})

describe('toAccount: how late the zero address is caught', () => {
  it('accepts the zero address from createWallet, then refuses to build an account on it', async () => {
    const { wallet, fetchSpy } = serverWalletAgainst({
      wallets: { json: { walletId: WALLET_ID, walletAddress: zeroAddress } },
    })

    // Step one reports success. This is the call a caller would act on.
    const created = await wallet.createWallet()
    expect(created.walletAddress).toBe(zeroAddress)
    expect(reached(fetchSpy, WALLETS_ROUTE)).toBe(true)

    // Step two is where it is finally refused -- after the wallet "exists".
    const outcome = await caught(
      wallet.toAccount({ address: created.walletAddress }),
    )

    expect(blamesTheInput(outcome, /missing, malformed, or zero/i)).toBe(true)
  })

  it('builds an account on the address the KMS actually returned', async () => {
    const { wallet } = serverWalletAgainst({ wallets: { json: createdWallet } })

    const created = await wallet.createWallet()
    const account = await wallet.toAccount({ address: created.walletAddress })

    expect(account.address).toBe(createdWallet.walletAddress)
  })
})
