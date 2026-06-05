import type { CreateSmartRoutingAddressParams } from '@zerodev/smart-routing-address'
import type { Address, Chain } from 'viem'

/**
 * Connector-level config for the Smart Routing Address (SRA) feature.
 * Consumers pass this on `zeroDevWallet({ config: { smartRoutingAddress: ... } })`.
 *
 * All fields are optional; per-call overrides on the hook / components win
 * over these defaults.
 */
export interface SmartRoutingAddressConfig {
  /**
   * When false, the SRA UI / hook short-circuits (returns nothing). Defaults
   * to true if the `smartRoutingAddress` block is present at all.
   */
  enabled?: boolean
  /**
   * Maximum slippage in basis points (BPS). Default: `100` (1%).
   */
  maxSlippage?: number
  /**
   * Destination chains the user can route funds to. The first entry is used
   * as the default destination when the consumer does not override it.
   */
  destinationChains?: Chain[]
  /**
   * Source chains the user can fund from. Surfaced by `<ChainSelector>` in
   * the SRA card.
   */
  sourceChains?: Chain[]
}

/**
 * Per-call overrides accepted by `useSmartRoutingAddress` and the SRA card.
 * Anything passed here takes precedence over the connector config.
 */
export interface SmartRoutingAddressOverrides {
  owner?: Address
  destChain?: CreateSmartRoutingAddressParams['destChain']
  srcTokens?: CreateSmartRoutingAddressParams['srcTokens']
  maxSlippage?: number
  actions?: CreateSmartRoutingAddressParams['actions']
}
