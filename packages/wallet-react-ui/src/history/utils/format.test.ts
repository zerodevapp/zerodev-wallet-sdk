import { describe, expect, it } from 'vitest'
import { formatAge, formatDateTime, formatUsd } from './format'

describe('formatUsd', () => {
  it('formats dollars with cents and grouping', () => {
    expect(formatUsd(2498.12)).toBe('$2,498.12')
    expect(formatUsd(0.525)).toBe('$0.53')
  })

  it('floors a positive amount under a cent instead of showing $0.00', () => {
    expect(formatUsd(0.004)).toBe('<$0.01')
    expect(formatUsd(0.005)).toBe('$0.01')
    expect(formatUsd(0)).toBe('$0.00')
  })
})

describe('formatDateTime', () => {
  it('formats a local date and time', () => {
    const timestamp = new Date(2026, 8, 21, 15, 4).getTime()
    expect(formatDateTime(timestamp)).toBe('Sep 21, 2026, 3:04 PM')
  })
})

describe('formatAge', () => {
  it.each([
    [-5_000, 'just now'],
    [59_999, 'just now'],
    [60_000, '1 min ago'],
    [59 * 60_000, '59 min ago'],
    [60 * 60_000, '1 h ago'],
    [26 * 60 * 60_000, '26 h ago'],
  ])('formats %i ms as %s', (ageMs, expected) => {
    expect(formatAge(ageMs)).toBe(expected)
  })
})
