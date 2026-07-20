'use client'

/**
 * Mock deposit layer for the demo. The SRA widget polls
 * `zd_getSmartRoutingAddressStatus`; here we intercept only that RPC call in
 * the browser and return a synthetic deposit list, so a sample deposit can
 * flow through the real widget UI (loading → detected → confirmed) without
 * any funds or real network. Address creation + fee estimates still hit the
 * live API — only the polling status is mocked.
 */

const STATUS_METHOD = 'zd_getSmartRoutingAddressStatus'

export type MockDeposit = {
  deposit: {
    chainId: number
    token: string
    amount: string
    blockNumber: string
    transactionHash: string
  }
  bridge: { blockNumber: string; transactionHash: string } | null
  execution: {
    blockNumber: string
    chainId: number | null
    outputToken: string
    transactionHash: string
    outputAmount: string
  } | null
  error: string | null
  createdAt?: string
}

let current: MockDeposit[] = []
let nativeFetch: typeof globalThis.fetch | null = null

export function setMockDeposits(deposits: MockDeposit[]): void {
  current = deposits
}

/** Past simulated deposits persist in localStorage so repeated simulations
 * accumulate across reloads. Cleared safely. */
const PAST_KEY = 'sra-demo-past-deposits'

export function loadPastDeposits(): MockDeposit[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(PAST_KEY)
    return raw ? (JSON.parse(raw) as MockDeposit[]) : []
  } catch {
    return []
  }
}

export function savePastDeposits(deposits: MockDeposit[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PAST_KEY, JSON.stringify(deposits))
  } catch {
    // Storage unavailable (private mode / quota) — non-fatal for the demo
  }
}

export function installMockFetch(): void {
  if (typeof window === 'undefined' || nativeFetch) return
  nativeFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const body = typeof init?.body === 'string' ? init.body : ''
    const passthrough = nativeFetch as typeof globalThis.fetch
    if (body.includes(STATUS_METHOD)) {
      return jsonRpcResponse({
        deposits: current,
        totalCount: current.length,
        nextPage: null,
        totalPages: 1,
      })
    }
    return passthrough(input, init)
  }
}

export function uninstallMockFetch(): void {
  if (typeof window === 'undefined' || !nativeFetch) return
  window.fetch = nativeFetch
  nativeFetch = null
  current = []
}

function jsonRpcResponse(result: unknown, id: number | string = 1): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function randomHash(): string {
  let hex = ''
  for (let i = 0; i < 64; i++) {
    hex += Math.floor(Math.random() * 16).toString(16)
  }
  return `0x${hex}`
}

function netAmount(amount: string, feeAmount: string): string {
  try {
    const gross = BigInt(amount)
    const fee = BigInt(feeAmount)
    return (gross > fee ? gross - fee : 0n).toString()
  } catch {
    return amount
  }
}

export type MockStage = 'pending' | 'bridging' | 'completed'

export type MockSimulationParams = {
  sourceChainId: number
  token: string
  amount: string
  feeAmount: string
  destChainId: number
  outputToken: string
}

/** A single simulation shares one deposit hash across stages so the widget
 * keeps tracking the same row while bridge/execution fields fill in. */
export function createSimulation(params: MockSimulationParams) {
  const depositHash = randomHash()
  const bridgeHash = randomHash()
  const execHash = randomHash()

  const snapshot = (stage: MockStage): MockDeposit => ({
    deposit: {
      chainId: params.sourceChainId,
      token: params.token,
      amount: params.amount,
      blockNumber: '0x1',
      transactionHash: depositHash,
    },
    bridge:
      stage === 'pending'
        ? null
        : { blockNumber: '0x2', transactionHash: bridgeHash },
    execution:
      stage === 'completed'
        ? {
            blockNumber: '0x3',
            chainId: params.destChainId,
            outputToken: params.outputToken,
            transactionHash: execHash,
            outputAmount: netAmount(params.amount, params.feeAmount),
          }
        : null,
    error: null,
    createdAt: new Date().toISOString(),
  })

  return { snapshot }
}
