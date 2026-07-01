import type { RpcTransactionRequest } from 'viem'

export function isEthTransfer(tx: RpcTransactionRequest): boolean {
  const hasValue = tx.value != null && BigInt(tx.value) > 0n
  const hasNoData = !tx.data || tx.data === '0x'
  return hasValue && hasNoData
}
