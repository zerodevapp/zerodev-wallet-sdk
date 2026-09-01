import type { Config, Connector } from '@wagmi/core'
import {
  type TransactionHistoryResponse,
  TransactionHistoryResponseSchema,
} from '@zerodev/data-api-contract'
import type { DataApiEnvironment } from '@zerodev/data-api-stamp'
import {
  getZeroDevConnector,
  getZeroDevStore,
  getZeroDevWallet,
  NotAuthenticatedError,
} from '@zerodev/wallet-react'
import { InvalidDataApiResponseError } from '../errors.js'
import { requestDataApiGet } from '../transport/requestDataApi.js'

const TRANSACTION_HISTORY_PATH = '/v1/me/transaction-history'

/**
 * Fetch one page for the account that the connector exposes to the dapp
 * (Kernel in 4337 mode, EOA in 7702/EOA mode).
 */
export async function getTransactionHistory(
  config: Config,
  parameters: getTransactionHistory.Parameters,
): Promise<getTransactionHistory.ReturnType> {
  const connector = parameters.connector ?? getZeroDevConnector(config)
  if (connector.id !== 'zerodev-wallet') throw new NotAuthenticatedError()

  const accounts = await connector.getAccounts()
  const walletAddress = accounts[0]
  if (!walletAddress) throw new NotAuthenticatedError()

  const store = await getZeroDevStore(connector)
  const wallet = getZeroDevWallet(store)
  const query: Record<string, string> =
    parameters.next === undefined ? {} : { next: parameters.next }
  const body = await requestDataApiGet({
    baseUrl: parameters.baseUrl,
    environment: parameters.environment ?? 'mainnet',
    path: TRANSACTION_HISTORY_PATH,
    query,
    stamper: wallet.client.apiKeyStamper,
    walletAddress,
    ...(parameters.signal === undefined ? {} : { signal: parameters.signal }),
  })

  const parsed = TransactionHistoryResponseSchema.safeParse(body)
  if (!parsed.success) throw new InvalidDataApiResponseError(parsed.error)
  return parsed.data
}

export declare namespace getTransactionHistory {
  type Parameters = {
    baseUrl: string
    connector?: Connector
    environment?: DataApiEnvironment
    next?: string
    signal?: AbortSignal
  }
  type ReturnType = TransactionHistoryResponse
  type ErrorType = Error
}
