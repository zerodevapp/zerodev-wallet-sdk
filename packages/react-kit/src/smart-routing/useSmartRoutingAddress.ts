import { useQuery } from '@tanstack/react-query'
import {
  type CreateSmartRoutingAddressParams,
  createCall,
  createSmartRoutingAddress,
  FLEX,
} from '@zerodev/smart-routing-address'
import { type Address, erc20Abi } from 'viem'
import { useConfig } from 'wagmi'
import { useStore } from 'zustand'
import type { createStore } from '../store'
import type { UseSmartRoutingAddressParams } from './types'

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
  srcTokens: UseSmartRoutingAddressParams['srcTokens'],
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
  // Build one action per unique src tokenType. Across needs to know the
  // concrete token on the destination chain; using a generic "ERC20" key
  // would resolve to a FLEX placeholder (0xff…ff) and fail simulation.
  const actions: CreateSmartRoutingAddressParams['actions'] = {}
  const seen = new Set<string>()
  for (const { tokenType } of srcTokens) {
    if (seen.has(tokenType)) continue
    seen.add(tokenType)
    actions[tokenType] =
      tokenType === 'NATIVE'
        ? { action: [nativeCall], fallBack: [] }
        : { action: [erc20Call], fallBack: [] }
  }
  return actions
}

/**
 * Computes a Smart Routing Address. Returns a React Query result.
 *
 * The query is disabled when the SRA feature flag is off
 * (`config.smartRoutingAddress.enabled === false`).
 */
export function useSmartRoutingAddress({
  owner,
  destChain,
  srcTokens,
  slippage = DEFAULT_SLIPPAGE_BPS,
  actions,
}: UseSmartRoutingAddressParams) {
  const wagmiConfig = useConfig()
  const store = getKitStore(wagmiConfig)
  if (!store) {
    throw new Error(
      'useSmartRoutingAddress must be used with zeroDevWallet connector',
    )
  }

  const config = useStore(store, (state) => state.smartRouting.config)
  const enabled = !!config && config.enabled !== false

  const resolvedActions = actions ?? buildDefaultActions(owner, srcTokens)

  return useQuery({
    queryKey: [
      'zerodev-wallet-kit',
      'smartRoutingAddress',
      owner,
      destChain.id,
      slippage,
      srcTokens.map((t) => [t.tokenType, t.chain.id, t.minAmount?.toString()]),
    ],
    enabled,
    queryFn: async () => {
      const result = await createSmartRoutingAddress({
        owner,
        destChain,
        slippage,
        srcTokens,
        actions: resolvedActions,
      })
      // The SDK currently swallows JSON-RPC error bodies (200 OK with `error`
      // instead of `result`) and returns `undefined`. React Query forbids
      // undefined data, so promote it to a proper error.
      if (!result) {
        throw new Error('Smart routing address service returned no result')
      }
      return result
    },
    meta: { persist: false },
  })
}
