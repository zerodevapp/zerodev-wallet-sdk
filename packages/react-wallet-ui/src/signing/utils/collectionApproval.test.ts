import type { RpcTransactionRequest } from 'viem'
import { encodeFunctionData } from 'viem'
import { describe, expect, it } from 'vitest'
import {
  decodeCollectionApproval,
  isCollectionApproval,
} from './collectionApproval'

const OPERATOR = '0x000000000000000000000000000000000000dEaD'

const setApprovalForAllAbi = [
  {
    type: 'function',
    name: 'setApprovalForAll',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

function buildApprovalTx(
  approved: boolean,
  overrides?: Partial<RpcTransactionRequest>,
): RpcTransactionRequest {
  return {
    to: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D', // BAYC
    data: encodeFunctionData({
      abi: setApprovalForAllAbi,
      functionName: 'setApprovalForAll',
      args: [OPERATOR, approved],
    }),
    ...overrides,
  } as RpcTransactionRequest
}

describe('isCollectionApproval', () => {
  it('returns true for setApprovalForAll', () => {
    expect(isCollectionApproval(buildApprovalTx(true))).toBe(true)
  })

  it('returns false when data is missing', () => {
    expect(isCollectionApproval({ to: '0x1234' })).toBe(false)
  })

  it('returns false for an ERC-20 approve selector', () => {
    const tx: RpcTransactionRequest = {
      to: '0x1234',
      data: '0x095ea7b3',
    }
    expect(isCollectionApproval(tx)).toBe(false)
  })
})

describe('decodeCollectionApproval', () => {
  it('decodes operator and approved=true', () => {
    const result = decodeCollectionApproval(buildApprovalTx(true))
    expect(result).not.toBeNull()
    expect(result!.operator.toLowerCase()).toBe(OPERATOR.toLowerCase())
    expect(result!.approved).toBe(true)
  })

  it('decodes operator and approved=false (revoke)', () => {
    const result = decodeCollectionApproval(buildApprovalTx(false))
    expect(result).not.toBeNull()
    expect(result!.operator.toLowerCase()).toBe(OPERATOR.toLowerCase())
    expect(result!.approved).toBe(false)
  })

  it('returns null for non-matching data', () => {
    expect(
      decodeCollectionApproval({ to: '0x1234', data: '0x1234' }),
    ).toBeNull()
  })

  it('returns null for missing data', () => {
    expect(decodeCollectionApproval({ to: '0x1234' })).toBeNull()
  })
})
