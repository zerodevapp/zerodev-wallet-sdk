import { describe, expect, it } from 'vitest'
import { formatDateTime, formatUsd } from './format'

describe('formatUsd', () => {
  it('formats dollars with cents and grouping', () => {
    expect(formatUsd(2498.12)).toBe('$2,498.12')
    expect(formatUsd(0.525)).toBe('$0.53')
  })
})

describe('formatDateTime', () => {
  it('formats a local date and time', () => {
    const timestamp = new Date(2026, 8, 21, 15, 4).getTime()
    expect(formatDateTime(timestamp)).toBe('Sep 21, 2026, 3:04 PM')
  })
})
