import { zeroAddress } from 'viem'
import { arbitrum, optimism } from 'viem/chains'
import { describe, expect, it } from 'vitest'
import { OPTIMISM_USDC, TEST_ESTIMATED_FEES } from '../test/fixtures'
import { findFeeData, resolveTokenAddress } from './fees'

describe('resolveTokenAddress', () => {
  it('resolves NATIVE to the zero address', () => {
    expect(resolveTokenAddress('NATIVE', optimism.id)).toBe(zeroAddress)
  })

  it('resolves known tokens from SDK constants', () => {
    expect(resolveTokenAddress('USDC', optimism.id)).toBe(OPTIMISM_USDC)
  })

  it('returns null for generic ERC20', () => {
    expect(resolveTokenAddress('ERC20', optimism.id)).toBeNull()
  })

  it('returns null for unknown token on chain', () => {
    expect(resolveTokenAddress('EURC', arbitrum.id)).toBeNull()
  })
})

describe('findFeeData', () => {
  it('finds fee data by chain and token type', () => {
    const feeData = findFeeData(TEST_ESTIMATED_FEES, optimism.id, 'USDC')
    expect(feeData?.name).toBe('USDC')
    expect(feeData?.decimal).toBe(6)
  })

  it('matches token addresses case-insensitively', () => {
    const uppercased = TEST_ESTIMATED_FEES.map((fee) => ({
      ...fee,
      data: fee.data.map((data) => ({
        ...data,
        // Uppercase the hex body only; the 0x prefix must stay lowercase
        token: `0x${data.token.slice(2).toUpperCase()}` as typeof data.token,
      })),
    }))
    expect(findFeeData(uppercased, optimism.id, 'USDC')).not.toBeNull()
  })

  it('returns null when the chain has no estimates', () => {
    expect(findFeeData(TEST_ESTIMATED_FEES, arbitrum.id, 'USDC')).toBeNull()
  })
})
