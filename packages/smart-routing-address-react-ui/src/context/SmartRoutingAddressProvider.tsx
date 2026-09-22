import type { CreateSmartRoutingAddressParams } from '@zerodev/smart-routing-address'
import { createSmartRoutingAddress } from '@zerodev/smart-routing-address'
import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react'
import type { Address } from 'viem'
import type {
  ActiveRoute,
  AddressState,
  SmartRoutingAddressConfig,
} from '../types'
import {
  resolveActions,
  resolveDestChain,
  resolveSourceTokens,
  resolveVersion,
} from '../utils/config'
import { SmartRoutingAddressContext } from './SmartRoutingAddressContext'

export type SmartRoutingAddressProviderProps = {
  config: SmartRoutingAddressConfig
  children: ReactNode
}

/**
 * Holds the config and the lazily created routing address. Wrap the subtree
 * that renders <SmartRoutingAddress /> with this provider — the deposit UI
 * itself is rendered inline by the consumer, not by this provider.
 */
export function SmartRoutingAddressProvider({
  config,
  children,
}: SmartRoutingAddressProviderProps) {
  const [addressState, setAddressState] = useState<AddressState>({
    status: 'idle',
  })
  const [recipient, setRecipient] = useState<Address | undefined>(undefined)
  const [activeRoute, setActiveRoute] = useState<ActiveRoute | null>(null)
  const pendingRef = useRef<Promise<Address> | null>(null)
  const recipientRef = useRef<Address | null>(null)
  // Each creation request gets a generation; only the latest generation
  // may write state, so superseded requests are ignored entirely
  const genRef = useRef(0)
  const configRef = useRef(config)

  const getOrCreateAddress = useCallback(
    async (nextRecipient: Address): Promise<Address> => {
      // A new config invalidates any cached request
      if (configRef.current !== config) {
        configRef.current = config
        genRef.current += 1
        pendingRef.current = null
        recipientRef.current = null
      }

      // Reuse the pending/settled request for the same recipient
      if (pendingRef.current && recipientRef.current === nextRecipient) {
        return pendingRef.current
      }

      genRef.current += 1
      const gen = genRef.current
      recipientRef.current = nextRecipient
      setRecipient(nextRecipient)

      const request = (async () => {
        setAddressState({ status: 'loading' })
        try {
          const version = resolveVersion(config)
          // The params discriminate on the version literal (legacy actions
          // carry `fallBack`, v1 actions must not); `resolveActions` builds
          // the shape matching `version`, so the union is narrowed by hand.
          const result = await createSmartRoutingAddress({
            owner: nextRecipient,
            // The SDK appends the project id to the server URL; the demo
            // and other project-less setups send an empty id.
            projectId: config.projectId ?? '',
            destChain: resolveDestChain(config),
            version,
            slippage: config.slippage,
            srcTokens: resolveSourceTokens(config),
            actions: resolveActions(config, nextRecipient, version),
            // Drop source tokens without an available route instead
            // of failing the whole address creation
            allowPartialRoutes: true,
            ...(config.baseUrl && { config: { baseUrl: config.baseUrl } }),
          } as CreateSmartRoutingAddressParams)
          // State writes are generation-gated (results superseded by a newer
          // request must not clobber the live one), but the promise still
          // resolves with the address this call created — per-call semantics
          // stay honest even after the provider has moved on.
          if (genRef.current === gen) {
            setAddressState({
              status: 'success',
              address: result.smartRoutingAddress,
              estimatedFees: result.estimatedFees,
            })
          }
          return result.smartRoutingAddress
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error))
          // Superseded failures must not clear the live request
          if (genRef.current === gen) {
            // Allow a retry after failures
            pendingRef.current = null
            setAddressState({ status: 'error', error: err })
          }
          throw err
        }
      })()

      pendingRef.current = request
      return request
    },
    [config],
  )

  const retry = useCallback(async () => {
    const current = recipientRef.current
    if (!current) return
    // Force a fresh request even if we still have a settled one cached
    pendingRef.current = null
    recipientRef.current = null
    // Failures surface via `addressState`; swallow the rejection so retry
    // callers (e.g. the ErrorRetryCard click handler) don't need a catch.
    await getOrCreateAddress(current).catch(() => {})
  }, [getOrCreateAddress])

  const value = useMemo(
    () => ({
      config,
      addressState,
      recipient,
      getOrCreateAddress,
      retry,
      activeRoute,
      setActiveRoute,
    }),
    [config, addressState, recipient, getOrCreateAddress, retry, activeRoute],
  )

  return (
    <SmartRoutingAddressContext.Provider value={value}>
      {children}
    </SmartRoutingAddressContext.Provider>
  )
}
