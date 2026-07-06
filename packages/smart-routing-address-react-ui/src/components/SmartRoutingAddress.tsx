import { PoweredBy, Screen, Text, TopNav } from '@zerodev/react-ui'
import { useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { useSmartRoutingAddressContext } from '../context/SmartRoutingAddressContext'
import { useDepositStatus } from '../hooks/useDepositStatus'
import { useNewDeposits } from '../hooks/useNewDeposits'
import type { SourceToken } from '../types'
import {
  getDestTokenSymbol,
  getSourceTokenSymbol,
  resolveBaseUrl,
  resolveDestChain,
  resolveFillTimeSeconds,
  resolvePollingInterval,
  sourceTokensFromFees,
} from '../utils/config'
import { findFeeData } from '../utils/fees'
import {
  formatDisplayAmount,
  formatDuration,
  formatSlippage,
} from '../utils/format'
import { AddressStatusPill } from './AddressStatusPill'
import { ArrivesCard } from './ArrivesCard'
import { DirectionToggle } from './DirectionToggle'
import { MinDepositPill } from './MinDepositPill'
import { SendCard } from './SendCard'
import { SmartFundingCard } from './SmartFundingCard'
import { TokenChainPill } from './TokenChainPill'

export type SmartRoutingAddressProps = {
  /** Recipient wallet address the routing address is created for. */
  recipient: Address
  /** Called when the user clicks the top-right × button. */
  onClose: () => void
  /** Optional handler for the top-left ? help button. */
  onHelp?: (() => void) | undefined
  className?: string | undefined
}

function isSameToken(a: SourceToken, b: SourceToken): boolean {
  return a.chain.id === b.chain.id && a.tokenType === b.tokenType
}

/**
 * The Figma "Deposit funds" screen — rendered inside the shared `Screen`
 * frame (border ring, gradient background) with a `TopNav` showing the help
 * button, title, and close button.
 *
 * Wrap the subtree with `<SmartRoutingAddressProvider config={...}>` first.
 */
export function SmartRoutingAddress({
  recipient,
  onClose,
  onHelp,
  className,
}: SmartRoutingAddressProps) {
  const { config, addressState, ensureAddress } =
    useSmartRoutingAddressContext()

  const success = addressState.status === 'success' ? addressState : null
  const address = success?.address
  const estimatedFees = success?.estimatedFees ?? []

  // allowPartialRoutes lets the server drop source tokens it can't route, so
  // the routable set is exactly the tokens the fee estimates came back with.
  const srcTokens = useMemo(
    () => sourceTokensFromFees(estimatedFees),
    [estimatedFees],
  )

  const [selectedSource] = useState<SourceToken | null>(null)

  // Keep the selection while it stays routable; otherwise fall back to the
  // first available source (null when none are routable yet).
  const routable =
    selectedSource &&
    srcTokens.some((token) => isSameToken(token, selectedSource))
  const source = (routable ? selectedSource : srcTokens[0]) ?? null

  useEffect(() => {
    // Errors surface via `addressState.status === 'error'` — swallow
    // here so React doesn't warn about an unhandled rejection.
    ensureAddress(recipient).catch(() => {})
  }, [recipient, ensureAddress])

  const { deposits, hasLoaded } = useDepositStatus({
    address,
    pollingInterval: resolvePollingInterval(config),
    baseUrl: resolveBaseUrl(config),
  })
  useNewDeposits(deposits, hasLoaded)

  const { destChain, destSymbol, sourceSymbol, feeData, fillTime } =
    useMemo(() => {
      const destChain = resolveDestChain(config)
      const destSymbol = getDestTokenSymbol(config, source)
      return {
        destChain,
        destSymbol,
        sourceSymbol: source ? getSourceTokenSymbol(source) : destSymbol,
        feeData: source
          ? findFeeData(estimatedFees, source.chain.id, source.tokenType)
          : null,
        fillTime: formatDuration(
          resolveFillTimeSeconds(config, source?.chain.id ?? destChain.id),
        ),
      }
    }, [config, source, estimatedFees])

  const slippage =
    typeof config.slippage === 'number' ? formatSlippage(config.slippage) : '—'

  // Estimated fee — the SDK returns a raw token amount; render as
  // "0.0000 USDC" until we have percentage math from the routing server.
  const estimatedFee = feeData
    ? `${formatDisplayAmount(feeData.fee, feeData.decimal, 'up')} ${sourceSymbol}`
    : '—'

  const minDepositAmount =
    feeData && sourceSymbol
      ? `${formatDisplayAmount(feeData.minDeposit, feeData.decimal, 'up')} ${sourceSymbol}`
      : null

  const sourceChainName = source?.chain.name ?? 'Base'

  return (
    <Screen
      className={className}
      topNav={
        <TopNav title="Deposit funds" onHelp={onHelp} onClose={onClose} />
      }
    >
      <div className="zd:flex zd:flex-col zd:gap-4 zd:items-center zd:w-full zd:h-full">
        <Text className="zd:text-center zd:w-full">
          Send any supported token from any network. We'll swap &amp; bridge it
          directly to your account, ready to use.
        </Text>

        <div className="zd:flex zd:flex-1 zd:flex-col zd:gap-2 zd:items-start zd:w-full zd:relative">
          <SendCard
            tokenPill={
              <TokenChainPill
                label={sourceSymbol ?? '—'}
                logoBg="#2775CA"
                logoInitial={(sourceSymbol ?? '?').charAt(0)}
                onClick={() => {
                  /* dropdown wiring — deferred */
                }}
              />
            }
            chainPill={
              <TokenChainPill
                label={sourceChainName}
                logoBg="#0052FF"
                logoInitial={sourceChainName.charAt(0)}
                onClick={() => {
                  /* dropdown wiring — deferred */
                }}
              />
            }
            slippage={slippage}
            estimatedFee={estimatedFee}
          />

          {/* Direction toggle sits between the two cards */}
          <div className="zd:flex zd:justify-center zd:w-full zd:-my-4 zd:z-10">
            <DirectionToggle />
          </div>

          <ArrivesCard
            destTokenPill={
              <TokenChainPill
                label={destSymbol}
                logoBg="#2775CA"
                logoInitial={destSymbol.charAt(0)}
                disabled
              />
            }
            destChainPill={
              <TokenChainPill
                label={destChain.name}
                logoBg="#28A0F0"
                logoInitial={destChain.name.charAt(0)}
                disabled
              />
            }
            readyIn={fillTime ? fillTime.replace('~', '≈ ') : undefined}
            addressStatus={
              addressState.status === 'idle' ? null : (
                <AddressStatusPill
                  status={
                    addressState.status === 'success'
                      ? 'success'
                      : addressState.status === 'error'
                        ? 'error'
                        : 'loading'
                  }
                  address={address}
                  error={
                    addressState.status === 'error'
                      ? addressState.error
                      : undefined
                  }
                  onRetry={() => {
                    ensureAddress(recipient).catch(() => {})
                  }}
                />
              )
            }
            minDeposit={
              minDepositAmount ? (
                <MinDepositPill amount={minDepositAmount} />
              ) : null
            }
          />

          <SmartFundingCard
            text={`Watching for your deposit on ${sourceChainName}…`}
          />
        </div>

        <PoweredBy className="zd:justify-center zd:pt-3" />
      </div>
    </Screen>
  )
}
