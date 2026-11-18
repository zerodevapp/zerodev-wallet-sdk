import type { TxHistoryEntry } from '../types'

export interface DayGroup {
  /** Section header: "Today", "Yesterday", or e.g. "August 12, 2025". */
  label: string
  entries: TxHistoryEntry[]
}

/** Local-midnight day index for a timestamp — calendar-day identity. */
function dayKey(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(timestamp: number, now: number): string {
  const key = dayKey(timestamp)
  if (key === dayKey(now)) return 'Today'
  if (key === dayKey(now - 24 * 60 * 60 * 1000)) return 'Yesterday'
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(timestamp))
}

/**
 * Newest-first entries bucketed by local calendar day, ready to render as
 * header + rows sections. `now` is injectable so tests (and midnight
 * boundaries) are deterministic.
 */
export function groupByDay(
  entries: TxHistoryEntry[],
  now: number = Date.now(),
): DayGroup[] {
  const sorted = [...entries].sort((a, b) => b.timestampMs - a.timestampMs)
  const groups: DayGroup[] = []
  let currentKey: string | null = null
  for (const entry of sorted) {
    const key = dayKey(entry.timestampMs)
    if (key !== currentKey) {
      currentKey = key
      groups.push({ label: dayLabel(entry.timestampMs, now), entries: [] })
    }
    groups[groups.length - 1]?.entries.push(entry)
  }
  return groups
}
