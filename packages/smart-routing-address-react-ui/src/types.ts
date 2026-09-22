import type {
  CreateSmartRoutingAddressParams,
  DepositedToken,
  GetSmartRoutingAddressFeeEstimatesReturns,
  SmartRoutingAddressVersion,
  TOKEN_TYPE,
} from '@zerodev/smart-routing-address'
import type { Address, Chain } from 'viem'

/** `DepositedToken` with the optional `createdAt` some SRA servers ship
 * alongside the response. The SDK's public type doesn't include it yet, so
 * we model it as an optional augmentation here — one canonical shape shared
 * by the pending/past/detail views. */
export type DepositWithTimestamp = DepositedToken & { createdAt?: string }

type SdkEstimatedFee =
  GetSmartRoutingAddressFeeEstimatesReturns['estimatedFees'][number]

/** SDK fee data plus the `isSponsored` flag pre-v1 servers send. v1 dropped
 * it from the SDK's public type (same-chain deposits no longer need fee
 * sponsorship), but hosts can still pin a 0.2.x version, so it stays as an
 * optional augmentation. */
export type EstimatedFeeData = SdkEstimatedFee['data'][number] & {
  isSponsored?: boolean
}

export type EstimatedFee = Omit<SdkEstimatedFee, 'data'> & {
  data: EstimatedFeeData[]
}

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
  /** Smart routing address version, defaults to the latest supported */
  version?: SmartRoutingAddressVersion
  /**
   * Destination actions per token type. When omitted, funds are simply
   * transferred to the owner.
   */
  actions?: CreateSmartRoutingAddressParams['actions']
  /**
   * Max slippage in basis points (50 = 0.5%).
   */
  slippage: number
  /**
   * Override the smart routing address server root URL; the projectId is
   * appended to it
   */
  baseUrl?: string
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
  /** Estimated all-in fee amount in source-token atomic units, as a
   * base-10 string (e.g. `"250000"` for 0.25 USDC). Consumers can pass it
   * straight to `BigInt()` or `parseInt(x, 10)`. */
  feeAmount: string
}
