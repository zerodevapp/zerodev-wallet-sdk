const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const dateTime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** A positive amount that would round to $0.00 reads as "<$0.01". */
export function formatUsd(amount: number): string {
  if (amount > 0 && amount < 0.005) return '<$0.01'
  return usd.format(amount)
}

export function formatDateTime(timestampMs: number): string {
  return dateTime.format(new Date(timestampMs))
}

/** A negative age, from clock skew or a render clock that lags a refresh,
 * reads as "just now". */
export function formatAge(ageMs: number): string {
  const minutes = Math.floor(Math.max(0, ageMs) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  return `${Math.floor(minutes / 60)} h ago`
}
