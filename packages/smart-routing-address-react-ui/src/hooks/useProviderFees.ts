import type { TOKEN_TYPE } from '@zerodev/smart-routing-address'
import { useEffect, useState } from 'react'
import type { Address, Chain } from 'viem'
import { zeroAddress } from 'viem'
import type { EstimatedFeeData, SourceToken } from '../types'
import { resolveTokenAddress } from '../utils/fees'
import {
  type FeeBreakdown,
  parseAcrossFees,
  parseRelayFees,
} from '../utils/providerFees'

const ACROSS_API = 'https://app.across.to/api/suggested-fees'
const RELAY_API = 'https://api.relay.link/quote'
// Quotes barely depend on the caller; used only when no recipient is known
const QUOTE_USER: Address = '0x1111111111111111111111111111111111111111'

type Route = {
  tokenType: TOKEN_TYPE
  originChainId: number
  destinationChainId: number
  amount: string
  user: Address
  symbol: string
  decimals: number
}

/** Across is keyed by ERC-20 addresses; native is quoted via its wrapped form */
function acrossToken(tokenType: TOKEN_TYPE, chainId: number): Address | null {
  if (tokenType === 'NATIVE') return resolveTokenAddress('WETH', chainId)
  return resolveTokenAddress(tokenType, chainId)
}

/** Relay represents native as the zero address; ERC-20s by their address */
function relayToken(tokenType: TOKEN_TYPE, chainId: number): Address | null {
  if (tokenType === 'NATIVE') return zeroAddress
  return resolveTokenAddress(tokenType, chainId)
}

async function fetchAcross(
  route: Route,
  signal: AbortSignal,
): Promise<FeeBreakdown | null> {
  const inputToken = acrossToken(route.tokenType, route.originChainId)
  const outputToken = acrossToken(route.tokenType, route.destinationChainId)
  if (!inputToken || !outputToken) return null
  const params = new URLSearchParams({
    inputToken,
    outputToken,
    originChainId: String(route.originChainId),
    destinationChainId: String(route.destinationChainId),
    amount: route.amount,
  })
  const res = await fetch(`${ACROSS_API}?${params}`, { signal })
  if (!res.ok) return null
  const json = await res.json()
  if (!json || json.error) return null
  return parseAcrossFees(json, route.symbol, route.decimals)
}

async function fetchRelay(
  route: Route,
  signal: AbortSignal,
): Promise<FeeBreakdown | null> {
  const originCurrency = relayToken(route.tokenType, route.originChainId)
  const destinationCurrency = relayToken(
    route.tokenType,
    route.destinationChainId,
  )
  if (!originCurrency || !destinationCurrency) return null
  const res = await fetch(RELAY_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      user: route.user,
      recipient: route.user,
      originChainId: route.originChainId,
      destinationChainId: route.destinationChainId,
      originCurrency,
      destinationCurrency,
      amount: route.amount,
      tradeType: 'EXACT_INPUT',
    }),
  })
  if (!res.ok) return null
  const json = await res.json()
  if (!json || json.error) return null
  return parseRelayFees(json)
}

/** Pick the cheaper live route by full quoted cost; else the first available */
function bestRoute(routes: (FeeBreakdown | null)[]): FeeBreakdown | null {
  const available = routes.filter((r): r is FeeBreakdown => r !== null)
  if (available.length === 0) return null
  const withUsd = available.filter((r) => r.quotedTotalUsd !== null)
  if (withUsd.length === 0) return available[0] ?? null
  return withUsd.reduce((best, r) =>
    (r.quotedTotalUsd as number) < (best.quotedTotalUsd as number) ? r : best,
  )
}

export type ProviderFeesState = {
  /** Cheapest normalised quote, or null while loading / unquotable */
  fees: FeeBreakdown | null
  /** True from the moment the route changes until the quotes resolve */
  loading: boolean
}

/**
 * Fetch live fee quotes for the selected route from every supported provider
 * (Across + Relay), normalise them, and return the cheapest. Across and Relay
 * expose the itemised bridge legs the SRA fee estimate alone does not, so this
 * enriches the breakdown with how the user is actually charged and which route
 * is currently best.
 *
 * Returns null while loading, for routes that can't be quoted (native /
 * unresolvable tokens), or when every request fails — callers fall back to
 * the SRA execution fee on their own.
 */
export function useProviderFees(
  source: SourceToken | null,
  destChain: Chain,
  feeData: EstimatedFeeData | null,
  recipient?: string,
): ProviderFeesState {
  const [breakdown, setBreakdown] = useState<FeeBreakdown | null>(null)
  const [loading, setLoading] = useState(false)

  const sourceChainId = source?.chain.id
  const tokenType = source?.tokenType
  const destChainId = destChain.id
  const minDeposit = feeData?.minDeposit
  const symbol = feeData?.name
  const decimals = feeData?.decimal

  useEffect(() => {
    setBreakdown(null)
    if (
      tokenType === undefined ||
      sourceChainId === undefined ||
      !minDeposit ||
      symbol === undefined ||
      decimals === undefined
    ) {
      setLoading(false)
      return
    }
    setLoading(true)

    let amount: string
    try {
      amount = BigInt(minDeposit).toString()
    } catch {
      return
    }

    const route: Route = {
      tokenType,
      originChainId: sourceChainId,
      destinationChainId: destChainId,
      amount,
      user: (recipient as Address) || QUOTE_USER,
      symbol,
      decimals,
    }

    const controller = new AbortController()
    const safe = (p: Promise<FeeBreakdown | null>) => p.catch(() => null)
    Promise.all([
      safe(fetchAcross(route, controller.signal)),
      safe(fetchRelay(route, controller.signal)),
    ])
      .then(([across, relay]) => {
        const chosen = bestRoute([across, relay])
        if (chosen) {
          // The USD price of the quoted amount comes from Relay — keep it
          // even when Across won on fees (used for the min-deposit USD pill
          // on non-stable tokens).
          chosen.inputUsd = chosen.inputUsd ?? relay?.inputUsd ?? null
        }
        if (!controller.signal.aborted) {
          setBreakdown(chosen)
          setLoading(false)
        }
      })
      .catch(() => {
        // All providers failed → caller shows the SRA fee
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [
    sourceChainId,
    tokenType,
    destChainId,
    minDeposit,
    symbol,
    decimals,
    recipient,
  ])

  return { fees: breakdown, loading }
}
