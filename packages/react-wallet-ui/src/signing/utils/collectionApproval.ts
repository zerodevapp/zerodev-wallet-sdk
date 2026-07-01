import {
  type Address,
  decodeFunctionData,
  type Hex,
  type RpcTransactionRequest,
  toFunctionSelector,
} from 'viem'

const erc721Abi = [
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

const SET_APPROVAL_FOR_ALL_SELECTOR = toFunctionSelector(
  'setApprovalForAll(address,bool)',
)

export function isCollectionApproval(tx: RpcTransactionRequest): boolean {
  return !!tx.data && tx.data.startsWith(SET_APPROVAL_FOR_ALL_SELECTOR)
}

export function decodeCollectionApproval(
  tx: RpcTransactionRequest,
): { operator: Address; approved: boolean } | null {
  if (!isCollectionApproval(tx)) return null

  try {
    const decoded = decodeFunctionData({
      abi: erc721Abi,
      data: tx.data as Hex,
    })
    if (decoded.functionName !== 'setApprovalForAll') return null
    return { operator: decoded.args[0], approved: decoded.args[1] }
  } catch {
    return null
  }
}
