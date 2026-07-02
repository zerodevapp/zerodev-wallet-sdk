import type { RpcTransactionRequest } from 'viem'
import { encodeFunctionData, erc20Abi, maxUint256 } from 'viem'
import { describe, expect, it } from 'vitest'
import { decodeErc20Approval, isErc20Approval } from './erc20Approval'

const SPENDER = '0x000000000000000000000000000000000000dEaD'
const AMOUNT = 1000000n

function buildApprovalTx(
  overrides?: Partial<RpcTransactionRequest>,
): RpcTransactionRequest {
  return {
    to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [SPENDER, AMOUNT],
    }),
    ...overrides,
  } as RpcTransactionRequest
}

describe('isErc20Approval', () => {
  it('returns true for an ERC-20 approval', () => {
    expect(isErc20Approval(buildApprovalTx())).toBe(true)
  })

  it('returns false when data is missing', () => {
    expect(isErc20Approval({ to: '0x1234' })).toBe(false)
  })

  it('returns false for a transfer selector', () => {
    const tx: RpcTransactionRequest = {
      to: '0x1234',
      data: '0xa9059cbb',
    }
    expect(isErc20Approval(tx)).toBe(false)
  })
})

describe('decodeErc20Approval', () => {
  it('decodes spender and amount', () => {
    const result = decodeErc20Approval(buildApprovalTx())
    expect(result).not.toBeNull()
    expect(result!.spender.toLowerCase()).toBe(SPENDER.toLowerCase())
    expect(result!.amount).toBe(AMOUNT)
  })

  it('decodes unlimited approval', () => {
    const tx = buildApprovalTx({
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [SPENDER, maxUint256],
      }),
    })
    const result = decodeErc20Approval(tx)
    expect(result).not.toBeNull()
    expect(result!.amount).toBe(maxUint256)
  })

  it('returns null for non-approval data', () => {
    expect(decodeErc20Approval({ to: '0x1234', data: '0x1234' })).toBeNull()
  })

  it('returns null for missing data', () => {
    expect(decodeErc20Approval({ to: '0x1234' })).toBeNull()
  })
})
