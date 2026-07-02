import type { RpcTransactionRequest } from 'viem'
import { encodeFunctionData, erc20Abi } from 'viem'
import { describe, expect, it } from 'vitest'
import { decodeErc20Transfer, isErc20Transfer } from './erc20Transfer'

const RECIPIENT = '0x000000000000000000000000000000000000dEaD'
const AMOUNT = 1000000n // 1 USDC (6 decimals)

function buildErc20Tx(
  overrides?: Partial<RpcTransactionRequest>,
): RpcTransactionRequest {
  return {
    to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC contract
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [RECIPIENT, AMOUNT],
    }),
    ...overrides,
  } as RpcTransactionRequest
}

describe('isErc20Transfer', () => {
  it('returns true for an ERC-20 transfer', () => {
    expect(isErc20Transfer(buildErc20Tx())).toBe(true)
  })

  it('returns false when data is missing', () => {
    expect(isErc20Transfer({ to: '0x1234' })).toBe(false)
  })

  it('returns false for non-transfer calldata', () => {
    const tx: RpcTransactionRequest = {
      to: '0x1234',
      data: '0x095ea7b3', // approve selector
    }
    expect(isErc20Transfer(tx)).toBe(false)
  })
})

describe('decodeErc20Transfer', () => {
  it('decodes recipient and amount', () => {
    const result = decodeErc20Transfer(buildErc20Tx())
    expect(result).not.toBeNull()
    expect(result!.to.toLowerCase()).toBe(RECIPIENT.toLowerCase())
    expect(result!.amount).toBe(AMOUNT)
  })

  it('returns null for non-ERC-20 data', () => {
    expect(decodeErc20Transfer({ to: '0x1234', data: '0x1234' })).toBeNull()
  })

  it('returns null for missing data', () => {
    expect(decodeErc20Transfer({ to: '0x1234' })).toBeNull()
  })
})
