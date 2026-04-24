import { describe, expect, it } from 'vitest'

import { camelCaseToTitle, capitalizeFirst, cn } from './common'

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
