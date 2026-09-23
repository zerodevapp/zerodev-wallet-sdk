import type { Address, Hash } from 'viem'
import { getAddress, numberToHex, parseUnits } from 'viem'
import {
  arbitrum,
  base,
  bsc,
  linea,
  mainnet,
  optimism,
  polygon,
  unichain,
} from 'viem/chains'
import type { MockRequest, MockRequestContext } from '../types.js'

/**
 * Mocks the Smart Routing Address backend.
 */

/** The SDK's default server; the lab sets no `baseUrl`, so this is the URL
 * both RPCs reach. The optional segment is the `/v2/<projectId>` form —
 * creation always appends `/<projectId>`, which with the lab's empty project
 * id leaves a bare trailing slash, so the segment may be empty. */
export const SRA_RPC_URL_PATTERN =
  /^https:\/\/api\.smart-routing-address\.zerodev\.app\/v2(\/[^/?]*)?$/

export const SRA_CREATE_METHOD = 'zd_createSmartRoutingAddress'
export const SRA_STATUS_METHOD = 'zd_getSmartRoutingAddressStatus'

/**
 * Fabricated, so an assertion on it cannot pass on real data.
 */
export const SRA_MOCK_ADDRESS: Address = getAddress(
  '0x5ea1f7c2b4e0d3a9c61b8e0d2f7a4c9b3d6e1a02',
)

/**
 * Constructs a hash by combining a head and tail with zero-padding in between.
 * @param head The leading segment of the hash.
 * @param tail The trailing segment of the hash.
 * @returns The combined hash as a `Hash` type.
 */
const hash = (head: string, tail: string): Hash =>
  `0x${head}${'0'.repeat(64 - head.length - tail.length)}${tail}` as Hash

export const SRA_DEPOSIT_HASH = hash('dead', 'beef')
const BRIDGE_HASH = hash('b41d', '6e00')
const EXECUTION_HASH = hash('e4ec', '0001')
const pastHash = (index: number) =>
  hash('9a57', index.toString(16).padStart(4, '0'))
/** Second and later live deposits; the first keeps `SRA_DEPOSIT_HASH`. The
 * index sits in the tail so truncated rows stay tellable apart on screen. */
const liveHash = (index: number) =>
  hash('dead', `beef${index.toString(16).padStart(2, '0')}`)

export const SRA_DEST_CHAIN_ID = arbitrum.id

export type SraSymbol = 'USDC' | 'USDT'

/**
 * Addresses must be the ones in the SDK's `SUPPORTED_TOKENS`, or
 * `sourceTokensFromFees` resolves nothing and the widget shows "No routes
 * found" even on the happy path.
 */
const TOKENS: Record<number, Partial<Record<SraSymbol, Address>>> = {
  [mainnet.id]: {
    USDT: getAddress('0xdac17f958d2ee523a2206206994597c13d831ec7'),
  },
  [optimism.id]: {
    USDC: getAddress('0x0b2c639c533813f4aa9d7837caf62653d097ff85'),
    USDT: getAddress('0x94b008aa00579c1307b0ef2c499ad98a8ce58e58'),
  },
  [bsc.id]: {
    USDC: getAddress('0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'),
    USDT: getAddress('0x55d398326f99059ff775485246999027b3197955'),
  },
  [polygon.id]: {
    USDT: getAddress('0xc2132d05d31c914a87c6611c10748aeb04b58e8f'),
  },
  [base.id]: {
    USDC: getAddress('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'),
    USDT: getAddress('0xfde4c96c8593536e31f229ea8f37b2ada2699bb2'),
  },
  [unichain.id]: {
    USDT: getAddress('0x9151434b16b9763660705744891fA906F660EcC5'),
  },
  [linea.id]: {
    USDT: getAddress('0xa219439258ca9da29e9cc4ce5596924745e12b93'),
  },
  [arbitrum.id]: {
    USDC: getAddress('0xaf88d065e77c8cc2239327c5edb3a432268e5831'),
    USDT: getAddress('0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9'),
  },
}

const DECIMALS: Record<SraSymbol, number> = { USDC: 6, USDT: 6 }

export type SraRoute = {
  chainId: number
  symbol: SraSymbol
  /** Whole tokens, e.g. `'0.52'`. Rendered as "Min deposit" in the widget. */
  minDeposit?: string
}

export function sraTokenAddress(chainId: number, symbol: SraSymbol): Address {
  const token = TOKENS[chainId]?.[symbol]
  if (!token) throw new Error(`no ${symbol} configured on chain ${chainId}`)
  return token
}

/**
 * Two symbols over an uneven spread of chains, so the token picker has
 * something to choose between and each token reports a different network
 * count. Distinct `minDeposit`s per symbol make it visible which route the
 * widget is quoting.
 */
export const SRA_DEFAULT_ROUTES: readonly SraRoute[] = [
  { chainId: optimism.id, symbol: 'USDC', minDeposit: '1.25' },
  { chainId: bsc.id, symbol: 'USDC', minDeposit: '1.25' },
  { chainId: base.id, symbol: 'USDC', minDeposit: '1.25' },
  { chainId: mainnet.id, symbol: 'USDT', minDeposit: '0.52' },
  { chainId: optimism.id, symbol: 'USDT', minDeposit: '0.52' },
  { chainId: bsc.id, symbol: 'USDT', minDeposit: '0.52' },
  { chainId: polygon.id, symbol: 'USDT', minDeposit: '0.52' },
  { chainId: base.id, symbol: 'USDT', minDeposit: '0.52' },
  { chainId: unichain.id, symbol: 'USDT', minDeposit: '0.52' },
  { chainId: linea.id, symbol: 'USDT', minDeposit: '0.52' },
]

/** 250 whole tokens gross, 0.15 as the fee, 1 as the default minimum. */
const DEPOSIT_WHOLE = '250'
const FEE_WHOLE = '0.15'
const MIN_DEPOSIT_WHOLE = '1'

const atomic = (whole: string, symbol: SraSymbol) =>
  parseUnits(whole, DECIMALS[symbol]).toString()

export const sraDepositAmount = (symbol: SraSymbol) =>
  atomic(DEPOSIT_WHOLE, symbol)
const sraFeeAmount = (symbol: SraSymbol) => atomic(FEE_WHOLE, symbol)

export type SraFeeData = {
  token: Address
  name: string
  decimal: number
  fee: `0x${string}`
  minDeposit: `0x${string}`
  maxDeposit: `0x${string}`
  isSponsored: boolean
}

export type SraEstimatedFee = { chainId: number; data: SraFeeData[] }

/** `fee` / `minDeposit` / `maxDeposit` are hex, `decimal` a number and `name`
 * a display symbol — the shape the widget's own fixtures use. */
function feesFromRoutes(
  routes: readonly SraRoute[],
  sponsored: boolean,
): SraEstimatedFee[] {
  const byChain = new Map<number, SraFeeData[]>()
  for (const route of routes) {
    const decimal = DECIMALS[route.symbol]
    const data = byChain.get(route.chainId) ?? []
    data.push({
      token: sraTokenAddress(route.chainId, route.symbol),
      name: route.symbol,
      decimal,
      fee: numberToHex(BigInt(sraFeeAmount(route.symbol))),
      minDeposit: numberToHex(
        BigInt(atomic(route.minDeposit ?? MIN_DEPOSIT_WHOLE, route.symbol)),
      ),
      maxDeposit: numberToHex(5_000n * 10n ** BigInt(decimal)),
      isSponsored: sponsored,
    })
    byChain.set(route.chainId, data)
  }
  return [...byChain].map(([chainId, data]) => ({ chainId, data }))
}

export type SraStage = 'pending' | 'bridging' | 'completed' | 'failed'

export type SraErrorMode =
  | 'none'
  | 'address-create-failed'
  | 'route-not-found'
  | 'polling-failed'

export type SraDeposit = {
  deposit: {
    chainId: number
    token: Address
    amount: string
    blockNumber: string
    transactionHash: Hash
  }
  bridge: { blockNumber: string; transactionHash: Hash } | null
  execution: {
    blockNumber: string
    chainId: number | null
    outputToken: Address
    transactionHash: Hash
    outputAmount: string
  } | null
  error: string | null
  createdAt: string
}

export const SRA_FAILURE_REASONS = [
  'Deposit was below the route minimum',
  'Deposit exceeded the route maximum',
  'Route expired before it could be filled',
] as const

export type SraMockOptions = {
  routes?: readonly SraRoute[]
  destChainId?: number
  depositRoute?: SraRoute
  errorMode?: SraErrorMode
  sponsored?: boolean
  pastDeposits?: SraDeposit[]
  stage?: SraStage | null
}

export type SraMockHandle = {
  mocks: MockRequest[]
  routes: readonly SraRoute[]
  stage: () => SraStage | null
  /** No argument walks pending → bridging → completed and stops. Acts on the
   * most recent deposit. */
  advance: (stage?: SraStage) => SraStage
  /**
   * Begin a new deposit with its own hash, and make it the one `advance`
   * acts on. Reusing a hash would mutate a row the widget has already seen,
   * which it never re-reports as newly arrived.
   */
  startDeposit: (stage?: SraStage) => SraStage
  fail: (reason?: string) => void
  /** Move the deposit onto another route, to match a picker selection. */
  setDepositRoute: (route: SraRoute) => void
  depositRoute: () => SraRoute
  setErrorMode: (mode: SraErrorMode) => void
  setSponsored: (value: boolean) => void
  addPastDeposits: (
    count: number,
    options?: { failed?: boolean; route?: SraRoute },
  ) => void
  /** Live and past alike — the clean slate the lab's "Clear" offers. */
  clearDeposits: () => void
  reset: () => void
  /** Per-RPC counts; `MockHandle.hits()` is an aggregate over both. */
  calls: () => { create: number; status: number }
  smartRoutingAddress: Address
  depositHash: Hash
}

const NEXT_STAGE: Record<SraStage, SraStage> = {
  pending: 'bridging',
  bridging: 'completed',
  completed: 'completed',
  failed: 'failed',
}

/** Overwritten by `echoJsonRpcId` with the request's own id. */
const RPC_ID = 1

const rpcResult = (result: object) => ({ jsonrpc: '2.0', id: RPC_ID, result })

/** HTTP 200, not a 4xx: `jsonRpcCall` turns an `error` member into an API
 * error, while a bad status short-circuits earlier as a network error. */
const rpcError = (message: string) => ({
  jsonrpc: '2.0',
  id: RPC_ID,
  error: { code: -32000, message },
})

function netAmount(amount: string, fee: string): string {
  const gross = BigInt(amount)
  const cost = BigInt(fee)
  return (gross > cost ? gross - cost : 0n).toString()
}

/** `deepHexlify` leaves numbers alone, so these arrive as numbers. Defaults
 * mirror the SDK's own. */
function readPaging(body: string): { page: number; pageSize: number } {
  try {
    const parsed = JSON.parse(body) as {
      params?: { page?: unknown; pageSize?: unknown }[]
    }
    const first = parsed.params?.[0]
    return {
      page: typeof first?.page === 'number' ? first.page : 1,
      pageSize: typeof first?.pageSize === 'number' ? first.pageSize : 50,
    }
  } catch {
    return { page: 1, pageSize: 50 }
  }
}

/**
 * A deposit on `route`, settling as the same symbol on `destChainId` — the
 * widget shows the source symbol as what arrives, so the two must agree.
 */
function depositOn(
  route: SraRoute,
  destChainId: number,
  transactionHash: Hash,
  parts: {
    bridgeHash?: Hash
    executionHash?: Hash
    error?: string | null
    createdAt: string
  },
): SraDeposit {
  const amount = sraDepositAmount(route.symbol)
  return {
    deposit: {
      chainId: route.chainId,
      token: sraTokenAddress(route.chainId, route.symbol),
      amount,
      blockNumber: '0x1',
      transactionHash,
    },
    bridge: parts.bridgeHash
      ? { blockNumber: '0x2', transactionHash: parts.bridgeHash }
      : null,
    execution: parts.executionHash
      ? {
          blockNumber: '0x3',
          chainId: destChainId,
          outputToken: sraTokenAddress(destChainId, route.symbol),
          transactionHash: parts.executionHash,
          outputAmount: netAmount(amount, sraFeeAmount(route.symbol)),
        }
      : null,
    error: parts.error ?? null,
    createdAt: parts.createdAt,
  }
}

/** Historical rows spread over days so date grouping has something to group. */
export function buildPastDeposits(
  startIndex: number,
  count: number,
  options: {
    failed?: boolean
    route?: SraRoute
    destChainId?: number
  } = {},
): SraDeposit[] {
  const route = options.route ?? SRA_DEFAULT_ROUTES[0]
  const destChainId = options.destChainId ?? SRA_DEST_CHAIN_ID
  const sixHours = 6 * 60 * 60 * 1000
  return Array.from({ length: count }, (_, offset) => {
    const index = startIndex + offset
    const failed = options.failed === true
    return depositOn(route, destChainId, pastHash(index), {
      ...(failed ? {} : { bridgeHash: pastHash(index) }),
      ...(failed ? {} : { executionHash: pastHash(index) }),
      error: failed
        ? (SRA_FAILURE_REASONS[index % SRA_FAILURE_REASONS.length] ?? null)
        : null,
      createdAt: new Date(Date.now() - index * sixHours).toISOString(),
    })
  })
}

export function createSraMocks(options: SraMockOptions = {}): SraMockHandle {
  type Live = {
    stage: SraStage
    bridged: boolean
    reason: string | null
    createdAt: string
    /** Own hash, so a second deposit is a second row rather than a mutation
     * of the first — which the widget would never show as newly arrived. */
    hash: Hash
    route: SraRoute
  }

  const startLive = (stage: SraStage, index: number, on: SraRoute): Live => ({
    stage,
    bridged: stage === 'bridging' || stage === 'completed',
    reason: null,
    createdAt: new Date().toISOString(),
    hash: index === 0 ? SRA_DEPOSIT_HASH : liveHash(index),
    route: on,
  })

  const routes = options.routes ?? SRA_DEFAULT_ROUTES
  const destChainId = options.destChainId ?? SRA_DEST_CHAIN_ID
  const firstRoute = routes[0]
  if (!firstRoute) throw new Error('createSraMocks needs at least one route')

  let lives: Live[] = []
  let route: SraRoute = firstRoute
  let errorMode: SraErrorMode = 'none'
  let sponsored = false
  let past: SraDeposit[] = []
  let pastCount = 0
  let statusSucceeded = false
  const counters = { create: 0, status: 0 }

  const liveDeposits = (): SraDeposit[] =>
    lives.map((entry) =>
      depositOn(entry.route, destChainId, entry.hash, {
        ...(entry.bridged && { bridgeHash: BRIDGE_HASH }),
        ...(entry.stage === 'completed' && { executionHash: EXECUTION_HASH }),
        error: entry.stage === 'failed' ? entry.reason : null,
        createdAt: entry.createdAt,
      }),
    )

  const statusResult = (request: MockRequestContext): object => {
    // Newest first, as the server reports them.
    const all = [...liveDeposits().reverse(), ...past]
    const { page, pageSize } = readPaging(request.body)
    const totalPages = Math.max(1, Math.ceil(all.length / pageSize))
    const start = (page - 1) * pageSize
    return {
      deposits: all.slice(start, start + pageSize),
      totalCount: all.length,
      nextPage: page < totalPages ? page + 1 : null,
      totalPages,
    }
  }

  const reset = (): void => {
    route = options.depositRoute ?? firstRoute
    lives = options.stage ? [startLive(options.stage, 0, route)] : []
    errorMode = options.errorMode ?? 'none'
    sponsored = options.sponsored ?? false
    past = [...(options.pastDeposits ?? [])]
    pastCount = past.length
    statusSucceeded = false
    counters.create = 0
    counters.status = 0
  }

  reset()

  const mocks: MockRequest[] = [
    {
      url: SRA_RPC_URL_PATTERN,
      method: 'POST',
      payload: { method: SRA_CREATE_METHOD },
      response: () => {
        counters.create += 1
        // A remount restarts polling, so the widget needs one good response
        // before it will show a polling error again.
        statusSucceeded = false
        if (errorMode === 'address-create-failed') {
          return rpcError('Mock: address creation unavailable')
        }
        return rpcResult({
          smartRoutingAddress: SRA_MOCK_ADDRESS,
          estimatedFees:
            errorMode === 'route-not-found'
              ? []
              : feesFromRoutes(routes, sponsored),
        })
      },
    },
    {
      url: SRA_RPC_URL_PATTERN,
      method: 'POST',
      payload: { method: SRA_STATUS_METHOD },
      response: (request) => {
        counters.status += 1
        // The widget only renders a polling error once a status call has
        // already succeeded, so the first one after a create always does.
        if (errorMode === 'polling-failed' && statusSucceeded) {
          return rpcError('Mock: status endpoint unavailable')
        }
        statusSucceeded = true
        return rpcResult(statusResult(request))
      },
    },
  ]

  const current = (): Live | undefined => lives[lives.length - 1]

  const startDeposit = (stage: SraStage = 'pending'): SraStage => {
    lives.push(startLive(stage, lives.length, route))
    return stage
  }

  const advance = (stage?: SraStage): SraStage => {
    const entry = current()
    if (!entry) return startDeposit(stage ?? 'pending')
    const next = stage ?? NEXT_STAGE[entry.stage]
    entry.stage = next
    entry.bridged ||= next === 'bridging' || next === 'completed'
    return next
  }

  return {
    mocks,
    routes,
    stage: () => current()?.stage ?? null,
    advance,
    startDeposit,
    fail: (reason) => {
      advance('failed')
      const entry = current()
      if (entry) entry.reason = reason ?? SRA_FAILURE_REASONS[0]
    },
    setDepositRoute: (next) => {
      route = next
    },
    depositRoute: () => route,
    setErrorMode: (mode) => {
      errorMode = mode
    },
    setSponsored: (value) => {
      sponsored = value
    },
    addPastDeposits: (count, addOptions = {}) => {
      past = [
        ...buildPastDeposits(pastCount, count, {
          route,
          destChainId,
          ...addOptions,
        }),
        ...past,
      ]
      pastCount += count
    },
    clearDeposits: () => {
      lives = []
      past = []
    },
    reset,
    calls: () => ({ ...counters }),
    smartRoutingAddress: SRA_MOCK_ADDRESS,
    depositHash: SRA_DEPOSIT_HASH,
  }
}
