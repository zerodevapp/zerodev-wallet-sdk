import { describe, expect, it } from 'vitest'
import { TRANSAK_NETWORKS } from './transak'

describe('TRANSAK_NETWORKS', () => {
  it('maps the major SRA source chains to Transak slugs', () => {
    expect(TRANSAK_NETWORKS[1]).toBe('ethereum')
    expect(TRANSAK_NETWORKS[8453]).toBe('base')
    expect(TRANSAK_NETWORKS[42161]).toBe('arbitrum')
  })

  it('has no slug for unknown chains (param is omitted, not wrong)', () => {
    expect(TRANSAK_NETWORKS[999999]).toBeUndefined()
  })
})
