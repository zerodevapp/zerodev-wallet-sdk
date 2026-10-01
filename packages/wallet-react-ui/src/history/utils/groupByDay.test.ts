import { describe, expect, it } from 'vitest'
import type { TxHistoryEntry } from '../types'
import { groupByDay } from './groupByDay'

// Fixed reference: a mid-day local time so day-boundary math is unambiguous.
const NOW = new Date(2026, 7, 13, 12, 0, 0).getTime()
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function entry(id: string, timestamp: number): TxHistoryEntry {
  return {
    id,
    icon: 'lighting',
    title: `Entry ${id}`,
    value: '1 ETH',
    chain: { name: 'Arbitrum One' },
    status: 'Success',
    timestampMs: timestamp,
  }
}

describe('groupByDay', () => {
  it('returns no groups for an empty feed', () => {
    expect(groupByDay([], NOW)).toEqual([])
  })

  it('labels the current calendar day "Today"', () => {
    const groups = groupByDay([entry('a', NOW - HOUR)], NOW)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.label).toBe('Today')
  })

  it('labels the previous calendar day "Yesterday"', () => {
    const groups = groupByDay([entry('a', NOW - DAY)], NOW)
    expect(groups[0]?.label).toBe('Yesterday')
  })

  it('labels older days with the full date', () => {
    const groups = groupByDay(
      [entry('a', new Date(2025, 7, 12).getTime())],
      NOW,
    )
    expect(groups[0]?.label).toBe('August 12, 2025')
  })

  it('groups by calendar day, not 24h windows', () => {
    // 2h before NOW is today; 20h before NOW is yesterday's calendar day
    // even though both are within 24 hours.
    const groups = groupByDay(
      [entry('today', NOW - 2 * HOUR), entry('yesterday', NOW - 20 * HOUR)],
      NOW,
    )
    expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday'])
  })

  it('sorts newest-first across and within groups', () => {
    const groups = groupByDay(
      [
        entry('old', NOW - 3 * DAY),
        entry('newest', NOW - HOUR),
        entry('newer', NOW - 2 * HOUR),
      ],
      NOW,
    )
    expect(groups[0]?.entries.map((e) => e.id)).toEqual(['newest', 'newer'])
    expect(groups[1]?.entries.map((e) => e.id)).toEqual(['old'])
  })

  it('does not mutate the input array', () => {
    const input = [entry('a', NOW - DAY), entry('b', NOW - HOUR)]
    const before = [...input]
    groupByDay(input, NOW)
    expect(input).toEqual(before)
  })
})
