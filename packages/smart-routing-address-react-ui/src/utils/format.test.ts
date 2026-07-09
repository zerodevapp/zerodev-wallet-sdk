import { describe, expect, it } from 'vitest'
import {
  formatDisplayAmount,
  formatDuration,
  formatSlippage,
  formatTokenAmount,
  truncateAddress,
} from './format'

describe('formatTokenAmount', () => {
  it('formats decimal string amounts', () => {
    expect(formatTokenAmount('2000000', 6)).toBe('2')
  })

  it('formats hex string amounts', () => {
    expect(formatTokenAmount('0x1e8480', 6)).toBe('2')
  })

  it('formats bigint amounts with fractions', () => {
    expect(formatTokenAmount(1_500_000n, 6)).toBe('1.5')
  })

  it('falls back to the raw value on invalid input', () => {
    expect(formatTokenAmount('not-a-number', 6)).toBe('not-a-number')
  })
})

describe('formatDisplayAmount', () => {
  it('groups thousands and drops fractions on large amounts', () => {
    // 343138.413368 with 6 decimals
    expect(formatDisplayAmount('343138413368', 6, 'down')).toBe('343,138')
  })

  it('keeps two decimals on mid-range amounts', () => {
    // 0.500103 rounds away from the user for minimums
    expect(formatDisplayAmount('500103', 6, 'up')).toBe('0.51')
    expect(formatDisplayAmount('500103', 6, 'down')).toBe('0.5')
    expect(formatDisplayAmount(1_500_000n, 6, 'down')).toBe('1.5')
  })

  it('keeps two significant digits on sub-unit amounts', () => {
    // 0.022488
    expect(formatDisplayAmount('22488', 6, 'up')).toBe('0.023')
    expect(formatDisplayAmount('22488', 6, 'down')).toBe('0.022')
  })

  it('handles zero and exact values without noise', () => {
    expect(formatDisplayAmount('0', 6, 'down')).toBe('0')
    expect(formatDisplayAmount('1000000', 6, 'up')).toBe('1')
    expect(formatDisplayAmount('0x12a05f200', 6, 'down')).toBe('5,000')
  })

  it('falls back to the raw value on invalid input', () => {
    expect(formatDisplayAmount('not-a-number', 6, 'down')).toBe('not-a-number')
  })
})

describe('truncateAddress', () => {
  it('truncates long addresses', () => {
    expect(truncateAddress('0x1111111111111111111111111111111111111111')).toBe(
      '0x1111…1111',
    )
  })

  it('leaves short values untouched', () => {
    expect(truncateAddress('0x1234')).toBe('0x1234')
  })
})

describe('formatSlippage', () => {
  it('converts basis points to percent', () => {
    expect(formatSlippage(50)).toBe('0.5%')
    expect(formatSlippage(100)).toBe('1%')
    expect(formatSlippage(125)).toBe('1.25%')
  })
})

describe('formatDuration', () => {
  it('formats seconds', () => {
    expect(formatDuration(30)).toBe('~30 sec')
  })

  it('formats minutes', () => {
    expect(formatDuration(120)).toBe('~2 min')
  })

  it('never reports zero seconds', () => {
    expect(formatDuration(0.2)).toBe('~1 sec')
  })
})
