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
  /**
   * Display symbol for the token received on the target chain (e.g. `"USDC"`).
   * Fixed by the configured actions — when omitted the UI joins every possible
   * target symbol with a separator.
   */
  targetTokenSymbol?: string
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

/**
 * The route the deposit UI is currently showing (selected source token +
 * chain + estimated fee), surfaced through context so hosts can mirror it —
 * e.g. a demo "send" panel that matches the chosen token, or analytics.
 */
export type ActiveRoute = {
  /** Source chain id the deposit would come from */
  sourceChainId: number
  /** Source chain display name (e.g. "Base") */
  sourceChainName: string
  /** On-chain address of the selected source token */
  token: Address
  /** Display symbol of the selected source token (e.g. "USDC", "ETH") */
  symbol: string
  /** Decimals of the selected source token */
  decimals: number
  /** Estimated all-in fee amount in source token atomic units */
  feeAmount: string
}
