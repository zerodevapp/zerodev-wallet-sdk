import { formatUnits } from 'viem'

/**
 * Format a raw token amount (decimal string, hex string or bigint) into a
 * human readable unit string. Falls back to the raw value if parsing fails.
 */
export function formatTokenAmount(
  value: string | bigint,
  decimals: number,
): string {
  try {
    const amount = typeof value === 'bigint' ? value : BigInt(value)
    return formatUnits(amount, decimals)
  } catch {
    return String(value)
  }
}

/** Rounding direction for display amounts */
export type RoundDirection = 'up' | 'down'

function displayFractionDigits(value: number): number {
  if (value >= 1000) return 0
  if (value >= 1) return 2
  // Two significant digits for sub-unit amounts
  return Math.min(8, 1 - Math.floor(Math.log10(value)))
}

/**
 * Format a raw token amount for display: thousands grouping and a
 * magnitude-aware precision (whole numbers above 1000, two decimals above 1,
 * two significant digits below). Rounds in the given direction so limits and
 * fees are never overstated/understated. Falls back to the raw value if
 * parsing fails.
 */
export function formatDisplayAmount(
  value: string | bigint,
  decimals: number,
  round: RoundDirection,
): string {
  let amount: number
  try {
    amount = Number(
      formatUnits(typeof value === 'bigint' ? value : BigInt(value), decimals),
    )
  } catch {
    return String(value)
  }
  if (amount === 0) return '0'

  const digits = displayFractionDigits(amount)
  const factor = 10 ** digits
  const rounded =
    (round === 'up'
      ? Math.ceil(amount * factor)
      : Math.floor(amount * factor)) / factor
  return rounded.toLocaleString('en-US', {
    maximumFractionDigits: digits,
  })
}

export function truncateAddress(address: string): string {
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function formatSlippage(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2).replace(/\.?0+$/, '')}%`
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `~${Math.max(1, Math.round(seconds))} sec`
  return `~${Math.round(seconds / 60)} min`
}

/** ISO timestamp → compact "N unit ago" ("just now", "2 m ago", "3 h ago",
 * "5 d ago", "2 mo ago", "1 y ago"). Returns `null` on invalid input. */
export function formatRelativeTime(
  iso: string,
  now: number = Date.now(),
): string | null {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return null
  const seconds = Math.max(0, Math.round((now - then) / 1000))
  if (seconds < 30) return 'just now'
  if (seconds < 60) return `${seconds} s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} d ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months} mo ago`
  const years = Math.round(months / 12)
  return `${years} y ago`
}
