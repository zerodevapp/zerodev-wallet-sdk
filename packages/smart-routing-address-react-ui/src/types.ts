import type {
  CreateSmartRoutingAddressParams,
  GetSmartRoutingAddressFeeEstimatesReturns,
  SmartRoutingAddressVersion,
  TOKEN_TYPE,
} from '@zerodev/smart-routing-address'
import type { Address, Chain } from 'viem'

export type EstimatedFee =
  GetSmartRoutingAddressFeeEstimatesReturns['estimatedFees'][number]

export type EstimatedFeeData = EstimatedFee['data'][number]

/** Internal chain-object form of a source token */
export type SourceToken = {
  tokenType: TOKEN_TYPE
  chain: Chain
  minAmount?: bigint
}

export type SmartRoutingAddressConfig = {
  /**
   * ZeroDev project id; when non-empty it is appended to the server URL
   * for every request
   */
  projectId?: string
  /** Chain id where funds settle */
  targetChainId: number
  /** Smart routing address version, defaults to the latest stable */
  version?: SmartRoutingAddressVersion
  /**
   * Destination actions per token type. When omitted, funds are simply
   * transferred to the owner.
   */
  actions?: CreateSmartRoutingAddressParams['actions']
  /** Max slippage in basis points (50 = 0.5%) */
  slippage?: number
  /**
   * Override the smart routing address server root URL; the projectId is
   * appended to it
   */
  baseUrl?: string
  /** Deposit status polling interval in ms */
  pollingInterval?: number
  /**
   * Expected fill time in seconds, either a flat value or per source
   * chain id
   */
  estimatedFillTimeSeconds?: number | Record<number, number>
}

export type AddressState =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'success'
      address: Address
      estimatedFees: EstimatedFee[]
    }
  | { status: 'error'; error: Error }

export type DepositStage = 'pending' | 'bridging' | 'completed' | 'failed'
