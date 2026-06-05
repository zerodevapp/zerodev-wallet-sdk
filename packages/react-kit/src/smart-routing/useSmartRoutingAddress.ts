import { useQuery } from '@tanstack/react-query'
import {
  type CreateSmartRoutingAddressParams,
  createCall,
  createSmartRoutingAddress,
  FLEX,
} from '@zerodev/smart-routing-address'
import { type Address, erc20Abi } from 'viem'
import { useAccount, useChainId, useChains, useConfig } from 'wagmi'
import { useStore } from 'zustand'
import type { createStore } from '../store'
import type {
  SmartRoutingAddressConfig,
  SmartRoutingAddressOverrides,
} from './types'

type Store = ReturnType<typeof createStore>

const DEFAULT_SLIPPAGE_BPS = 100 // 1%

function getKitStore(config: ReturnType<typeof useConfig>): Store | null {
  const connector = config.connectors.find((c) => c.id === 'zerodev-wallet')
  if (!connector || !('getKitStore' in connector)) return null
  // @ts-expect-error - getKitStore is a custom method on the kit connector
  return connector.getKitStore()
}

function buildDefaultActions(
  owner: Address,
): CreateSmartRoutingAddressParams['actions'] {
  const nativeCall = createCall({
    target: owner,
    value: FLEX.NATIVE_AMOUNT,
  })
  const erc20Call = createCall({
    target: FLEX.TOKEN_ADDRESS,
    value: 0n,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [owner, FLEX.AMOUNT],
  })
  return {
    NATIVE: { action: [nativeCall], fallBack: [] },
    ERC20: { action: [erc20Call], fallBack: [] },
  }
}

/**
 * Computes a Smart Routing Address from the connector's `smartRoutingAddress`
 * config and optional per-call overrides. Returns a React Query state object.
 *
 * Defaults applied when `overrides` does not specify them:
 *   - `owner`: connected wallet address (`useAccount`)
 *   - `destChain`: first chain in `config.destinationChains`, else the chain
 *      matching the wallet's current `chainId` (`useChainId`/`useChains`)
 *   - `maxSlippage`: `config.maxSlippage`, else 100 BPS (1%)
 *   - `actions`: NATIVE + ERC-20 deposit-to-owner (mirror of doorway)
 *
 * The query is disabled when the feature is not enabled, when no owner is
 * connected, when no destination chain is resolvable, or when `srcTokens` is
 * empty — in those cases the hook returns `{ data: undefined, isPending: false }`.
 */
export function useSmartRoutingAddress(
  overrides: SmartRoutingAddressOverrides = {},
) {
  const wagmiConfig = useConfig()
  const store = getKitStore(wagmiConfig)
  if (!store) {
    throw new Error(
      'useSmartRoutingAddress must be used with zeroDevWallet connector',
    )
  }

  const config = useStore(
    store,
    (state) => state.smartRouting.config,
  ) as SmartRoutingAddressConfig | null

  const { address: connectedAddress } = useAccount()
  const currentChainId = useChainId()
  const availableChains = useChains()

  const owner = overrides.owner ?? connectedAddress
  const destChain =
    overrides.destChain ??
    config?.destinationChains?.[0] ??
    availableChains.find((c) => c.id === currentChainId)
  const slippage =
    overrides.maxSlippage ?? config?.maxSlippage ?? DEFAULT_SLIPPAGE_BPS
  const srcTokens = overrides.srcTokens
  const actions =
    overrides.actions ?? (owner ? buildDefaultActions(owner) : undefined)

  const enabled =
    config?.enabled !== false &&
    !!config &&
    !!owner &&
    !!destChain &&
    !!srcTokens &&
    srcTokens.length > 0 &&
    !!actions

  return useQuery({
    queryKey: [
      'zerodev-wallet-kit',
      'smartRoutingAddress',
      owner,
      destChain?.id,
      slippage,
      srcTokens?.map((t) => [t.tokenType, t.chain.id, t.minAmount?.toString()]),
    ],
    enabled,
    queryFn: async () => {
      if (!owner || !destChain || !srcTokens || !actions) return null
      return createSmartRoutingAddress({
        owner,
        destChain,
        slippage,
        srcTokens,
        actions,
      })
    },
    meta: { persist: false },
  })
}
