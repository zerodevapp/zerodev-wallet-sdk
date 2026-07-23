import { formatUnits } from 'viem'
import type { EstimatedFeeData } from '../types'
import { formatDisplayAmount, STABLE_SYMBOLS } from './format'

/**
 * Standardised fee breakdown shared across routing providers. Each provider
 * (Across, Relay, …) exposes fees in its own shape; the parsers below map
 * them onto this single model so the fees view can render any of them
 * identically.
 *
 * A leg is either a `rate` (proportional to the deposit, e.g. capital / LP)
 * or `flat` (a fixed cost, e.g. destination gas). Because the deposit amount
 * is not known up front, each leg is shown only in its amount-invariant
 * form: a percentage for rates, a fixed USD value for flat costs.
 */
export type FeeKind = 'rate' | 'flat'

export type FeeLine = {
  key: string
  label: string
  kind: FeeKind
  /** Right-aligned accent: gas pump for gas legs, $ disc otherwise */
  accent: 'gas' | 'usd'
  /** Proportional rate as a percent (e.g. 0.01 for 0.01%); rate legs only */
  pct: number | null
  /** USD value at the quoted amount; the display value for flat legs */
  usd: number | null
  /** Raw fallback text (e.g. a token amount) when neither pct nor usd applies */
  text?: string
  /** True when the leg is waived (shown as "Sponsored") */
  sponsored?: boolean
}

export type FeeBreakdown = {
  /** Routing provider, or null when no itemised provider data is available */
  provider: string | null
  lines: FeeLine[]
  /** Combined proportional rate as a percent, e.g. 0.013 for "0.013%" */
  ratePct: number | null
  /** Combined flat (fixed) cost in USD */
  flatUsd: number | null
  /** Full cost in USD at the quoted amount — used to compare routes */
  quotedTotalUsd: number | null
  /** Headline fallback when USD isn't derivable (e.g. "0.00002 ETH") */
  totalText: string | null
  /** Estimated fill time in seconds, when the provider reports it */
  fillTimeSec: number | null
  /** USD value of the quoted amount, when the provider prices it (Relay) */
  inputUsd: number | null
}

function sum(values: (number | null)[]): number | null {
  return values.reduce<number | null>(
    (total, v) => (v === null ? total : (total ?? 0) + v),
    null,
  )
}

// ---------------------------------------------------------------------------
// Across — GET https://app.across.to/api/suggested-fees
// Fees are nested { pct, total } objects. `pct` is an 18-decimal fraction
// (1e18 = 100%); `total` is in input-token units. Capital and LP fees are
// true rates; the relayer gas fee is a fixed destination-gas cost (its pct
// only looks like a rate because it is gas/amount). totalRelayFee = sum of
// the three legs.
// ---------------------------------------------------------------------------

type AcrossLeg = { pct: string; total: string }
export type AcrossSuggestedFees = {
  totalRelayFee: AcrossLeg
  relayerCapitalFee: AcrossLeg
  relayerGasFee: AcrossLeg
  lpFee: AcrossLeg
  estimatedFillTimeSec?: number
}

const E18 = 10n ** 18n

/** 18-decimal Across fraction → percent (e.g. "150298578165425" → 0.0150) */
function acrossPct(raw: string): number | null {
  try {
    // percent = raw/1e18 * 100, kept to 4-decimal percent precision via
    // BigInt before Number conversion (raw can exceed 2^53).
    return Number((BigInt(raw) * 1_000_000n) / E18) / 10_000
  } catch {
    return null
  }
}

/** Across totals are in input-token units; USD only when the token is ~$1 */
function tokenUsd(
  total: string,
  decimals: number,
  symbol: string,
): number | null {
  if (!STABLE_SYMBOLS.has(symbol.toUpperCase())) return null
  try {
    return Number(formatUnits(BigInt(total), decimals))
  } catch {
    return null
  }
}

export function parseAcrossFees(
  res: AcrossSuggestedFees,
  symbol: string,
  decimals: number,
): FeeBreakdown {
  const leg = (
    key: string,
    label: string,
    kind: FeeKind,
    accent: FeeLine['accent'],
    data: AcrossLeg,
  ): FeeLine => ({
    key,
    label,
    kind,
    accent,
    pct: acrossPct(data.pct),
    usd: tokenUsd(data.total, decimals, symbol),
  })

  const lines: FeeLine[] = [
    leg('capital', 'Capital Fee', 'rate', 'usd', res.relayerCapitalFee),
    leg('destGas', 'Destination Gas', 'flat', 'gas', res.relayerGasFee),
    leg('lp', 'LP Fee', 'rate', 'usd', res.lpFee),
  ]

  return {
    provider: 'Across',
    lines,
    ratePct: sum(lines.filter((l) => l.kind === 'rate').map((l) => l.pct)),
    flatUsd: sum(lines.filter((l) => l.kind === 'flat').map((l) => l.usd)),
    quotedTotalUsd: tokenUsd(res.totalRelayFee.total, decimals, symbol),
    totalText: null,
    fillTimeSec:
      typeof res.estimatedFillTimeSec === 'number'
        ? res.estimatedFillTimeSec
        : null,
    inputUsd: null,
  }
}

// ---------------------------------------------------------------------------
// Relay — POST https://api.relay.link/quote
// Each fee carries `amountUsd` only (no rate), so every leg is treated as a
// fixed cost. `relayer` is the full relayer fee (relayerGas + relayerService);
// `gas` is the user's origin-chain gas.
// ---------------------------------------------------------------------------

type RelayFee = { amountUsd?: string }
export type RelayQuote = {
  fees?: {
    gas?: RelayFee
    relayer?: RelayFee
    relayerGas?: RelayFee
    relayerService?: RelayFee
    app?: RelayFee
  }
  details?: { currencyIn?: { amountUsd?: string }; timeEstimate?: number }
  timeEstimate?: number
}

function usdOf(fee?: RelayFee): number | null {
  if (!fee?.amountUsd) return null
  const value = Number(fee.amountUsd)
  return Number.isFinite(value) ? value : null
}

export function parseRelayFees(res: RelayQuote): FeeBreakdown {
  const fees = res.fees ?? {}
  const lines: FeeLine[] = []
  const push = (
    key: string,
    label: string,
    accent: FeeLine['accent'],
    fee?: RelayFee,
  ) => {
    const usd = usdOf(fee)
    if (usd === null) return
    // Drop zero-value optional legs (e.g. app fee)
    if (usd === 0 && (key === 'app' || key === 'originGas')) return
    // Relay exposes USD only, so every leg is shown as a fixed cost
    lines.push({ key, label, kind: 'flat', accent, pct: null, usd })
  }

  push('service', 'Service Fee', 'usd', fees.relayerService)
  push('destGas', 'Destination Gas', 'gas', fees.relayerGas)
  push('originGas', 'Origin Gas', 'gas', fees.gas)
  push('app', 'App Fee', 'usd', fees.app)

  const totalUsd = usdOf(fees.relayer)
  return {
    provider: 'Relay',
    lines,
    ratePct: null,
    flatUsd: sum(lines.map((l) => l.usd)),
    quotedTotalUsd: totalUsd,
    totalText: null,
    fillTimeSec: res.details?.timeEstimate ?? res.timeEstimate ?? null,
    inputUsd: usdOf(res.details?.currencyIn),
  }
}

// ---------------------------------------------------------------------------
// Dispatch + fallback
// ---------------------------------------------------------------------------

/** Detect the provider shape and normalise it; null when unrecognised */
export function normalizeProviderFees(
  res: unknown,
  symbol: string,
  decimals: number,
): FeeBreakdown | null {
  if (!res || typeof res !== 'object') return null
  const record = res as Record<string, unknown>
  if (record.totalRelayFee && typeof record.totalRelayFee === 'object') {
    return parseAcrossFees(res as AcrossSuggestedFees, symbol, decimals)
  }
  if (record.fees && typeof record.fees === 'object') {
    return parseRelayFees(res as RelayQuote)
  }
  return null
}

/**
 * Present the SRA fee as the actual all-in charge, with the provider's
 * bridge legs as a breakdown *of* it (not added on top — the SRA server fee
 * already covers bridging + execution). The execution portion is derived as
 * `SRA fee − bridge cost` so the legs sum back to the SRA fee. Without
 * provider data, the whole SRA fee is shown as a single execution line.
 */
export function buildFeeBreakdown(
  feeData: EstimatedFeeData,
  symbol: string,
  provider: FeeBreakdown | null = null,
): FeeBreakdown {
  // The SRA fee is the all-in amount ZeroDev charges (bridging + execution)
  const sraUsd = feeData.isSponsored
    ? 0
    : tokenUsd(feeData.fee, feeData.decimal, symbol)
  const bridgeUsd = provider?.quotedTotalUsd ?? null
  // Token-unit fallback for non-stablecoins where USD isn't derivable
  const feeToken = `${formatDisplayAmount(feeData.fee, feeData.decimal, 'up')} ${symbol}`

  // Execution = the part of the SRA fee not explained by the bridge legs
  const executionUsd = feeData.isSponsored
    ? 0
    : sraUsd === null
      ? null
      : bridgeUsd === null
        ? sraUsd
        : Math.max(0, sraUsd - bridgeUsd)

  const showTokenFallback = !feeData.isSponsored && sraUsd === null
  const executionLine: FeeLine = {
    key: 'execution',
    label: 'Execution Fee',
    kind: 'flat',
    accent: 'usd',
    pct: null,
    usd: executionUsd,
    // Show the SRA fee in token units when we can't price it in USD
    ...(showTokenFallback && { text: feeToken }),
    sponsored: feeData.isSponsored,
  }

  const lines = [executionLine, ...(provider?.lines ?? [])]

  return {
    provider: provider?.provider ?? null,
    lines,
    ratePct: sum(lines.filter((l) => l.kind === 'rate').map((l) => l.pct)),
    flatUsd: sum(lines.filter((l) => l.kind === 'flat').map((l) => l.usd)),
    // The headline charge is the SRA fee itself, never the sum on top of it
    quotedTotalUsd: feeData.isSponsored ? 0 : sraUsd,
    // Headline fallback for non-stable tokens (e.g. "0.00002 ETH")
    totalText: !feeData.isSponsored && sraUsd === null ? feeToken : null,
    fillTimeSec: provider?.fillTimeSec ?? null,
    inputUsd: provider?.inputUsd ?? null,
  }
}

/** Format a percent number for display, trimming to a sensible precision */
export function formatFeePct(pct: number): string {
  const digits = pct >= 1 ? 2 : pct >= 0.1 ? 2 : 3
  return `${pct.toFixed(digits)}%`
}

/** Format a USD number for display */
export function formatFeeUsd(usd: number): string {
  const digits = usd > 0 && usd < 0.01 ? 4 : 2
  return `$${usd.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  })}`
}
