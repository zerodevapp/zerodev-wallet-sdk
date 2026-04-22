import {
  type Address,
  decodeFunctionData,
  erc20Abi,
  type Hex,
  type RpcTransactionRequest,
  toFunctionSelector,
} from 'viem'

const ERC20_APPROVE_SELECTOR = toFunctionSelector('approve(address,uint256)')

export function isErc20Approval(tx: RpcTransactionRequest): boolean {
  return !!tx.data && tx.data.startsWith(ERC20_APPROVE_SELECTOR)
}

export function decodeErc20Approval(
  tx: RpcTransactionRequest,
): { spender: Address; amount: bigint } | null {
  if (!isErc20Approval(tx)) return null

  try {
    const decoded = decodeFunctionData({
      abi: erc20Abi,
      data: tx.data as Hex,
    })
    if (decoded.functionName !== 'approve') return null
    return { spender: decoded.args[0], amount: decoded.args[1] }
  } catch {
    return null
  }
}
