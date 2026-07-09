import { base, mainnet, monad, optimism } from 'viem/chains'
import { describe, expect, it } from 'vitest'
import { getChainById } from './chains'

describe('getChainById', () => {
  it('resolves known chain ids to viem chain objects', () => {
    expect(getChainById(mainnet.id)).toBe(mainnet)
    expect(getChainById(base.id)).toBe(base)
    expect(getChainById(optimism.id)).toBe(optimism)
    expect(getChainById(monad.id)).toBe(monad)
  })

  it('throws a descriptive error for unknown chain ids', () => {
    expect(() => getChainById(999_999)).toThrow(/Unsupported chain id 999999/)
  })
})
