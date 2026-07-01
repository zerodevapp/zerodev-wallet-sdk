import { describe, expect, it } from 'vitest'

import { cn } from './common'

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
