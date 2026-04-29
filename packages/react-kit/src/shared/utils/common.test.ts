import { describe, expect, it } from 'vitest'

import { camelCaseToTitle, capitalizeFirst, cn, shortenHex } from './common'

describe('cn', () => {
  it('joins multiple class strings', () => {
    expect(cn('p-2', 'text-white')).toBe('p-2 text-white')
  })

  it('ignores falsy values', () => {
    expect(cn('p-2', false, null, undefined, '', 'text-white')).toBe(
      'p-2 text-white',
    )
  })

  it('merges conflicting tailwind utilities, keeping the last one', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('supports conditional object syntax (clsx)', () => {
    expect(cn('base', { active: true, inactive: false })).toBe('base active')
  })

  it('merges custom font-size tokens from the extended config', () => {
    expect(cn('text-body2', 'text-body1')).toBe('text-body1')
  })
})

describe('capitalizeFirst', () => {
  it('uppercases the first character', () => {
    expect(capitalizeFirst('hello')).toBe('Hello')
  })

  it('leaves already-capitalized strings untouched', () => {
    expect(capitalizeFirst('Hello')).toBe('Hello')
  })

  it('returns an empty string for empty input', () => {
    expect(capitalizeFirst('')).toBe('')
  })

  it('returns an empty string for undefined', () => {
    expect(capitalizeFirst(undefined)).toBe('')
  })

  it('returns an empty string for null', () => {
    expect(capitalizeFirst(null)).toBe('')
  })

  it('only capitalizes the first letter, not the rest', () => {
    expect(capitalizeFirst('hELLO')).toBe('HELLO')
  })
})

describe('shortenHex', () => {
  it('shortens a 0x address with the default 4 chars on each side', () => {
    expect(shortenHex('0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8')).toBe(
      '0x94a9...E4C8',
    )
  })

  it('respects the length parameter', () => {
    expect(shortenHex('0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8', 6)).toBe(
      '0x94a9D9...d5E4C8',
    )
  })

  it('keeps the 0x prefix on the leading slice', () => {
    const result = shortenHex('0xabcdef0123456789abcdef0123456789abcdef01', 3)
    expect(result.startsWith('0xabc')).toBe(true)
    expect(result.endsWith('f01')).toBe(true)
    expect(result).toContain('...')
  })
})

describe('camelCaseToTitle', () => {
  it('converts single-word camelCase to Title Case', () => {
    expect(camelCaseToTitle('gasFee')).toBe('Gas Fee')
  })

  it('handles multiple camelCase words', () => {
    expect(camelCaseToTitle('transactionGasFee')).toBe('Transaction Gas Fee')
  })

  it('capitalizes a single lowercase word', () => {
    expect(camelCaseToTitle('amount')).toBe('Amount')
  })

  it('leaves strings that already start with uppercase untouched', () => {
    expect(camelCaseToTitle('From')).toBe('From')
    expect(camelCaseToTitle('PascalCase')).toBe('PascalCase')
  })

  it('returns empty string unchanged', () => {
    expect(camelCaseToTitle('')).toBe('')
  })
})
