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
  /**
   * Max slippage in basis points (50 = 0.5%).
   */
  slippage: number
  /**
   * Override the smart routing address server root URL; the projectId is
   * appended to it
   */
  baseUrl?: string
  /**
   * Optional fiat onramp (Transak). When set, the deposit screen shows a
   * "Buy with card" entry that opens the Transak on-ramp in-widget,
   * pre-filled with the selected route and the deposit address. Omit it to
   * hide the entry — access requires a KYB-approved Transak partner key.
   */
  onramp?: {
    /** Transak partner API key */
    transakApiKey: string
    /** Transak environment the key belongs to; defaults to `PRODUCTION` */
    environment?: 'STAGING' | 'PRODUCTION'
  }
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
