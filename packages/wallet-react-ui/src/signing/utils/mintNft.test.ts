import type { RpcTransactionRequest } from 'viem'
import { encodeFunctionData } from 'viem'
import { describe, expect, it } from 'vitest'
import { decodeMintNft, isMintNft } from './mintNft'

const TO = '0x000000000000000000000000000000000000dEaD'

const mintAbi = [
  {
    type: 'function',
    name: 'mint',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

function buildMintTx(
  overrides?: Partial<RpcTransactionRequest>,
): RpcTransactionRequest {
  return {
    to: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
    data: encodeFunctionData({
      abi: mintAbi,
      functionName: 'mint',
      args: [TO],
    }),
    ...overrides,
  } as RpcTransactionRequest
}

describe('isMintNft', () => {
  it('returns true for mint(address)', () => {
    expect(isMintNft(buildMintTx())).toBe(true)
  })

  it('returns false when data is missing', () => {
    expect(isMintNft({ to: '0x1234' })).toBe(false)
  })

  it('returns false for an ERC-20 transfer selector', () => {
    const tx: RpcTransactionRequest = {
      to: '0x1234',
      data: '0xa9059cbb',
    }
    expect(isMintNft(tx)).toBe(false)
  })
})

describe('decodeMintNft', () => {
  it('decodes the recipient address', () => {
    const result = decodeMintNft(buildMintTx())
    expect(result).not.toBeNull()
    expect(result!.to.toLowerCase()).toBe(TO.toLowerCase())
  })

  it('returns null for non-matching data', () => {
    expect(decodeMintNft({ to: '0x1234', data: '0x1234' })).toBeNull()
  })

  it('returns null for missing data', () => {
    expect(decodeMintNft({ to: '0x1234' })).toBeNull()
  })
})
