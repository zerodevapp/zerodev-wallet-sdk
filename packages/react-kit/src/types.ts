import type { Hex, RpcTransactionRequest } from 'viem'

// todo: these should be moved to core package and exported from there
export type Request =
  | {
      method: 'eth_sendTransaction'
      params: [transaction: RpcTransactionRequest]
    }
  | {
      method: 'wallet_sendTransaction'
      params: [transaction: RpcTransactionRequest]
    }
  | {
      method: 'personal_sign'
      params: [data: Hex, address: Hex]
    }
  | {
      method: 'eth_signTypedData_v4'
      params: [address: Hex, typedData: string]
    }

export type RequestMethod = Request['method']

export type PendingRequest = {
  id: string
  resolve: () => void
  reject: (reason?: unknown) => void
} & Request
