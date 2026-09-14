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
    /**
     * Mint a fresh Transak widget URL for the given route. Transak requires
     * the URL to come from its server-side session API (the partner API
     * secret must never reach the browser), so the host implements this
     * against its own backend: exchange the secret for an access token,
     * `POST /api/v2/auth/session` with the params, return `widgetUrl`. See
     * the sra-demo `app/api/transak-session` route for a working recipe.
     * Called on every "Buy with card" press — session URLs are single-use
     * and expire after 5 minutes, so they can't be pre-built or cached.
     */
    getWidgetUrl: (params: OnrampWidgetParams) => Promise<string>
  }
}

/** Route context the widget passes to `onramp.getWidgetUrl` so the Transak
 * session can be pre-filled. All fields are optional pass-throughs of
 * Transak's widget params. */
export type OnrampWidgetParams = {
  /** The SRA deposit address purchases should be delivered to. */
  walletAddress?: string | undefined
  /** Selected token symbol (e.g. "USDC"). */
  cryptoCurrencyCode?: string | undefined
  /** Selected source chain as a Transak network slug (e.g. "base"). */
  network?: string | undefined
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
