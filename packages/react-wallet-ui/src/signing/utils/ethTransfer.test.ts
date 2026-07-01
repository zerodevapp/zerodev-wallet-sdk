import type { RpcTransactionRequest } from 'viem'
import { describe, expect, it } from 'vitest'
import { isEthTransfer } from './ethTransfer'

describe('isEthTransfer', () => {
  it('returns true for a simple ETH transfer', () => {
    const tx: RpcTransactionRequest = {
      to: '0x1234567890abcdef1234567890abcdef12345678',
      value: '0xde0b6b3a7640000', // 1 ETH
    }
    expect(isEthTransfer(tx)).toBe(true)
  })

  it('returns true when data is 0x', () => {
    const tx: RpcTransactionRequest = {
      to: '0x1234567890abcdef1234567890abcdef12345678',
      value: '0x1',
      data: '0x',
    }
    expect(isEthTransfer(tx)).toBe(true)
  })

  it('returns false when value is 0', () => {
    const tx: RpcTransactionRequest = {
      to: '0x1234567890abcdef1234567890abcdef12345678',
      value: '0x0',
    }
    expect(isEthTransfer(tx)).toBe(false)
  })

  it('returns false when value is missing', () => {
    const tx: RpcTransactionRequest = {
      to: '0x1234567890abcdef1234567890abcdef12345678',
    }
    expect(isEthTransfer(tx)).toBe(false)
  })

  it('returns false when data is present', () => {
    const tx: RpcTransactionRequest = {
      to: '0x1234567890abcdef1234567890abcdef12345678',
      value: '0x1',
      data: '0xa9059cbb0000000000000000000000000000000000000000000000000000000000000001',
    }
    expect(isEthTransfer(tx)).toBe(false)
  })
})
