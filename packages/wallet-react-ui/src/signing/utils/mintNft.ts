import {
  type Address,
  decodeFunctionData,
  type Hex,
  type RpcTransactionRequest,
  toFunctionSelector,
} from 'viem'

const mintAbi = [
  {
    type: 'function',
    name: 'mint',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

const MINT_SELECTOR = toFunctionSelector('mint(address)')

export function isMintNft(tx: RpcTransactionRequest): boolean {
  return !!tx.data && tx.data.startsWith(MINT_SELECTOR)
}

export function decodeMintNft(
  tx: RpcTransactionRequest,
): { to: Address } | null {
  if (!isMintNft(tx)) return null

  try {
    const decoded = decodeFunctionData({
      abi: mintAbi,
      data: tx.data as Hex,
    })
    if (decoded.functionName !== 'mint') return null
    return { to: decoded.args[0] }
  } catch {
    return null
  }
}
