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
  resolveBaseUrl,
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
  const pendingRef = useRef<Promise<void> | null>(null)
  const recipientRef = useRef<Address | null>(null)
  // Each creation request gets a generation; only the latest generation
  // may write state, so superseded requests are ignored entirely
  const genRef = useRef(0)
  const configRef = useRef(config)

  const ensureAddress = useCallback(
    async (nextRecipient: Address) => {
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
          const baseUrl = resolveBaseUrl(config)
          const result = await createSmartRoutingAddress({
            owner: nextRecipient,
            destChain: resolveDestChain(config),
            ...(config.slippage !== undefined && {
              slippage: config.slippage,
            }),
            srcTokens: resolveSourceTokens(config),
            ...(resolveActions(config, nextRecipient) && {
              actions: resolveActions(config, nextRecipient),
            }),
            // Drop source tokens without an available route instead
            // of failing the whole address creation
            allowPartialRoutes: true,
            config: {
              ...(baseUrl && { baseUrl }),
              version: resolveVersion(config),
            },
          })
          // Ignore results superseded by a newer request
          if (genRef.current !== gen) return
          setAddressState({
            status: 'success',
            address: result.smartRoutingAddress,
            estimatedFees: result.estimatedFees,
          })
        } catch (error) {
          // Superseded failures must not clear the live request
          if (genRef.current !== gen) return
          // Allow a retry after failures
          pendingRef.current = null
          setAddressState({
            status: 'error',
            error: error instanceof Error ? error : new Error(String(error)),
          })
        }
      })()

      pendingRef.current = request
      return request
    },
    [config],
  )

  const value = useMemo(
    () => ({
      config,
      addressState,
      recipient,
      ensureAddress,
      activeRoute,
      setActiveRoute,
    }),
    [config, addressState, recipient, ensureAddress, activeRoute],
  )

  return (
    <SmartRoutingAddressContext.Provider value={value}>
      {children}
    </SmartRoutingAddressContext.Provider>
  )
}
