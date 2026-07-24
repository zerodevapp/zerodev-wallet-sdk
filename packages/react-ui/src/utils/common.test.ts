import { describe, expect, it } from 'vitest'

import { camelCaseToTitle, cn } from './common'

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
    expect(cn('zd:p-2', 'zd:p-4')).toBe('zd:p-4')
  })

  it('supports conditional object syntax (clsx)', () => {
    expect(cn('base', { active: true, inactive: false })).toBe('base active')
  })

  it('merges custom font-size tokens from the extended config', () => {
    expect(cn('zd:text-body2', 'zd:text-body1')).toBe('zd:text-body1')
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
