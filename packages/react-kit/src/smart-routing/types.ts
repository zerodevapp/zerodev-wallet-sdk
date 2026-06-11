import type { CreateSmartRoutingAddressParams } from '@zerodev/smart-routing-address'
import type { Address, Chain } from 'viem'

/**
 * Steps in the Smart Routing Address flow. Mirrors the `AuthStep` pattern:
 * the entry component dispatches each step to its page, and steps push/pop
 * a history so the TopNav back button works.
 */
export type SmartRoutingStep = 'transfer-from-wallet'

/**
 * Connector-level config for the Smart Routing Address (SRA) feature.
 * Consumers pass this on `zeroDevWallet({ config: { smartRoutingAddress: ... } })`.
 *
 * Fields here are *UI metadata + feature flag*, not defaults for the hook.
 * Per-call params on `useSmartRoutingAddress` are not derived from this.
 */
export interface SmartRoutingAddressConfig {
  /**
   * When false, `useSmartRoutingAddress` short-circuits (query disabled).
   * Defaults to `true` if the `smartRoutingAddress` block is present at all.
   */
  enabled?: boolean
  /**
   * Destination chains the SRA UI may surface (e.g. in a chain selector).
   * Informational — the hook requires an explicit `destChain` per call.
   */
  destinationChains?: Chain[]
  /**
   * Source chains the SRA UI may surface (e.g. in a chain selector).
   * Informational — the hook requires explicit `srcTokens` per call.
   */
  sourceChains?: Chain[]
}

/**
 * Inputs to `useSmartRoutingAddress`. All three core fields are required —
 * the hook computes a Smart Routing Address from exactly what's passed in
 * and doesn't infer defaults from wagmi state or the connector config.
 */
export interface UseSmartRoutingAddressParams {
  owner: Address
  destChain: CreateSmartRoutingAddressParams['destChain']
  srcTokens: NonNullable<CreateSmartRoutingAddressParams['srcTokens']>
  /** Maximum slippage in basis points. Defaults to `100` (1%). */
  slippage?: number
}
