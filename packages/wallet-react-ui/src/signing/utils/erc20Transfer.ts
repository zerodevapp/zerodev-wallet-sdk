import {
  type Address,
  decodeFunctionData,
  erc20Abi,
  type Hex,
  type RpcTransactionRequest,
  toFunctionSelector,
} from 'viem'

const ERC20_TRANSFER_SELECTOR = toFunctionSelector('transfer(address,uint256)')

export function isErc20Transfer(tx: RpcTransactionRequest): boolean {
  return !!tx.data && tx.data.startsWith(ERC20_TRANSFER_SELECTOR)
}

export function decodeErc20Transfer(
  tx: RpcTransactionRequest,
): { to: Address; amount: bigint } | null {
  if (!isErc20Transfer(tx)) return null

  try {
    const decoded = decodeFunctionData({
      abi: erc20Abi,
      data: tx.data as Hex,
    })
    if (decoded.functionName !== 'transfer') return null
    return { to: decoded.args[0], amount: decoded.args[1] }
  } catch {
    return null
  }
}
