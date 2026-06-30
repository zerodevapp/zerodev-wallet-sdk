import type { Hex } from 'viem'

export interface TypedDataField {
  name: string
  type: string
}

export interface EIP712Domain {
  chainId?: number
  name?: string
  verifyingContract?: Hex
  version?: string
  salt?: string
}

export interface TypedDataV4 {
  types: Record<string, TypedDataField[]>
  primaryType: string
  domain?: EIP712Domain
  message: Record<string, unknown>
}
