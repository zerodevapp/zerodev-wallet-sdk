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

export function formatUsd(amount: number): string {
  return usd.format(amount)
}

export function formatDateTime(timestampMs: number): string {
  return dateTime.format(new Date(timestampMs))
}
