import {
  ArrowCardPair,
  Button,
  cn,
  DataRow,
  Icon,
  Pill,
  Select,
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectTrigger,
  Text,
  TokenListItem,
  Tooltip,
  WrappedPressable,
  Wrapper,
} from '@zerodev/react-ui'
import type { DepositedToken, TOKEN_TYPE } from '@zerodev/smart-routing-address'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AddressDisplay } from '../components/AddressDisplay'
import { BuyWithCardButton } from '../components/BuyWithCardButton'
import { ErrorRetryCard } from '../components/ErrorRetryCard'
import {
  FeeBreakdownRows,
  FeeDisclosureButton,
  FeeSummary,
  LiveValue,
} from '../components/FeeBreakdown'
import { FEE_INFO } from '../components/FeeBreakdown/feeInfo'
import { LoadingCard } from '../components/LoadingCard'
import { OnrampSheet } from '../components/OnrampSheet'
import { PendingDeposits } from '../components/PendingDeposits'
import { DEFAULT_FILL_TIME_SECONDS } from '../constants'
import { useSmartRoutingAddressContext } from '../context/SmartRoutingAddressContext'
import { useDepositStatus } from '../hooks/useDepositStatus'
import { useNewDeposits } from '../hooks/useNewDeposits'
import { useProviderFees } from '../hooks/useProviderFees'
import { CHAIN_ICONS, PROVIDER_ICONS, TOKEN_ICONS } from '../iconAssets'
import type { SourceToken } from '../types'
import {
  getSourceTokenSymbol,
  resolveBaseUrl,
  resolveDestChain,
  sourceTokensFromFees,
} from '../utils/config'
import { findFeeData, resolveTokenAddress } from '../utils/fees'
import {
  formatDisplayAmount,
  formatDuration,
  formatSlippage,
} from '../utils/format'
import { buildFeeBreakdown } from '../utils/providerFees'
import { buildTransakUrl } from '../utils/transak'

export interface DepositProps {
  onQrClick?: () => void
  /** Navigate to the "Past deposits" view. When omitted, the row is hidden. */
  onViewPastDeposits?: () => void
  /** Fired when a pending-deposit row is tapped. Wires through to
   * `PendingDeposits` so an in-flight deposit opens the transaction-details
   * view, matching the past-deposits behaviour. */
  onSelectDeposit?: (deposit: DepositedToken) => void
}

const SUBTITLE =
  "Send any supported token from any network. We'll swap & bridge it directly to your account, ready to use."

// The two picker panels span the full pill row (Figma "Send" layout), not
// just the trigger cell each Select lives in. Trigger width = half the row
// minus half the 4px gap, so full-row width = trigger * 2 + 4px.
const FULL_ROW_PANEL_STYLE = {
  width: 'calc(var(--radix-select-trigger-width) * 2 + 4px)',
}

export function Deposit({
  onQrClick,
  onViewPastDeposits,
  onSelectDeposit,
}: DepositProps) {
  const { config, addressState, recipient, retry, setActiveRoute } =
    useSmartRoutingAddressContext()
  const [feeOpen, setFeeOpen] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [onrampOpen, setOnrampOpen] = useState(false)

  const success = addressState.status === 'success' ? addressState : null
  const address = success?.address
  const estimatedFees = success?.estimatedFees ?? []

  // allowPartialRoutes lets the server drop source tokens it can't route, so
  // the routable set is exactly the tokens the fee estimates came back with.
  const srcTokens = useMemo(
    () => sourceTokensFromFees(estimatedFees),
    [estimatedFees],
  )

  // Track the user's picker selection. `null` means "no explicit choice yet" —
  // an effect below seeds it to the first routable option once srcTokens land.
  const [selectedTokenType, setSelectedTokenType] = useState<TOKEN_TYPE | null>(
    null,
  )
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null)

  // Seed picker state from the first routable option as soon as srcTokens
  // arrive. Also re-seeds if a stale selection becomes unroutable.
  useEffect(() => {
    if (srcTokens.length === 0) return
    const currentValid = srcTokens.some(
      (t) =>
        t.tokenType === selectedTokenType && t.chain.id === selectedChainId,
    )
    if (currentValid) return
    // Prefer to keep the token, swap the chain to one that's available for it.
    const forSameToken = srcTokens.find(
      (t) => t.tokenType === selectedTokenType,
    )
    const fallback = forSameToken ?? srcTokens[0]
    if (!fallback) return
    setSelectedTokenType(fallback.tokenType)
    setSelectedChainId(fallback.chain.id)
  }, [srcTokens, selectedTokenType, selectedChainId])

  const source: SourceToken | null = useMemo(() => {
    if (!selectedTokenType || selectedChainId === null) {
      return srcTokens[0] ?? null
    }
    return (
      srcTokens.find(
        (t) =>
          t.tokenType === selectedTokenType && t.chain.id === selectedChainId,
      ) ??
      srcTokens[0] ??
      null
    )
  }, [srcTokens, selectedTokenType, selectedChainId])

  const {
    deposits,
    hasLoaded,
    error: depositsError,
    refetch: refetchDeposits,
  } = useDepositStatus({
    address,
    baseUrl: resolveBaseUrl(config),
  })
  const newDeposits = useNewDeposits(deposits, hasLoaded)
  const pastDepositsCount = deposits.length - newDeposits.length

  const destChain = resolveDestChain(config)
  // Widget's default actions forward the deposited token, so the destination
  // token equals the source token — one symbol and logo serve both cards.
  // Only the chain differs, hence the source/dest split below.
  const tokenSymbol = source ? getSourceTokenSymbol(source) : undefined
  const tokenLogo = tokenSymbol
    ? TOKEN_ICONS[tokenSymbol.toUpperCase()]
    : undefined
  const sourceChainLogo = source ? CHAIN_ICONS[source.chain.id] : undefined
  const destChainLogo = CHAIN_ICONS[destChain.id]
  const feeData = source
    ? findFeeData(estimatedFees, source.chain.id, source.tokenType)
    : null
  const fillTime = formatDuration(DEFAULT_FILL_TIME_SECONDS)

  // Live bridge quotes from Across / Relay, keyed off the selected route.
  // Enriches the SRA fee estimate with the itemised legs it doesn't expose.
  const providerFees = useProviderFees(source, destChain, feeData, recipient)
  const breakdown =
    feeData && tokenSymbol
      ? buildFeeBreakdown(feeData, tokenSymbol, providerFees.fees)
      : null

  // Publish the current picker selection so hosts (e.g. a demo "send" panel)
  // can mirror the widget's route. Cleared when the picker is empty so
  // downstream mocks show their fallback instead of stale state.
  useEffect(() => {
    if (!source || !feeData || !tokenSymbol) {
      setActiveRoute(null)
      return
    }
    const token = resolveTokenAddress(source.tokenType, source.chain.id)
    if (!token) {
      setActiveRoute(null)
      return
    }
    setActiveRoute({
      sourceChainId: source.chain.id,
      sourceChainName: source.chain.name,
      token,
      symbol: tokenSymbol,
      decimals: feeData.decimal,
      // `feeData.fee` is a `Hex` string from the SDK — normalise to a
      // decimal atomic-units string here so `activeRoute.feeAmount` has
      // one consistent representation across every write path (see
      // `ActiveRoute.feeAmount` — the demo's fallback uses decimals too).
      // Hosts using `BigInt()` work either way, but `Number()` /
      // `parseInt(x, 10)` would silently misread the hex form.
      feeAmount: BigInt(feeData.fee).toString(),
    })
  }, [source, feeData, tokenSymbol, setActiveRoute])

  // Deduped list of routable token types — the token picker's rows. Chain
  // count per token drives the subtitle. Kept as SourceToken (not a bespoke
  // dropdown-item shape) so the render below can call the same helpers used
  // for the trigger.
  const uniqueTokens = useMemo(() => {
    const seen = new Set<TOKEN_TYPE>()
    const out: SourceToken[] = []
    for (const token of srcTokens) {
      if (seen.has(token.tokenType)) continue
      seen.add(token.tokenType)
      out.push(token)
    }
    return out
  }, [srcTokens])

  // Chains that carry the currently-selected token — the chain picker's rows.
  const availableChains = useMemo(() => {
    if (!selectedTokenType) return []
    const seen = new Set<number>()
    const out: SourceToken[] = []
    for (const token of srcTokens) {
      if (token.tokenType !== selectedTokenType) continue
      if (seen.has(token.chain.id)) continue
      seen.add(token.chain.id)
      out.push(token)
    }
    return out
  }, [srcTokens, selectedTokenType])

  // Always present: config.slippage is required now that the SRA server no
  // longer supplies a default.
  const slippage = formatSlippage(config.slippage)

  const minDepositAmount =
    feeData && tokenSymbol
      ? `${formatDisplayAmount(feeData.minDeposit, feeData.decimal, 'up')} ${tokenSymbol}`
      : null

  // Flash key re-triggers the LiveValue animation on the estimated-fee row
  // when the underlying quote changes; combining every meaningful component
  // catches all updates in one dependency.
  const feeFlashKey = breakdown
    ? `${breakdown.totalText ?? ''}|${breakdown.ratePct ?? ''}|${breakdown.flatUsd ?? ''}`
    : ''

  const pickerDisabled = uniqueTokens.length === 0
  const sourceChainName = source?.chain.name

  // Error surfaces the retry card handles. Only one is shown at a time,
  // matched top-down in severity order: (1) address creation itself failed,
  // (2) creation succeeded but no routes came back, (3) deposit polling is
  // erroring after we already have an address. `hasLoaded` gates the polling
  // case so first-load latency isn't mistaken for an error.
  const addressError = addressState.status === 'error'
  const noRoutesError = !!success && srcTokens.length === 0
  const pollingError = !!address && !!depositsError && hasLoaded
  const errorMessage = addressError
    ? 'Failed to create deposit address...'
    : noRoutesError
      ? 'No routes found, try one more time...'
      : pollingError
        ? 'Failed to load deposits, try again...'
        : null

  const handleRetry = useCallback(async () => {
    if (retrying) return
    setRetrying(true)
    try {
      if (pollingError && !addressError && !noRoutesError) {
        refetchDeposits()
      } else {
        await retry()
      }
    } finally {
      setRetrying(false)
    }
  }, [
    retrying,
    pollingError,
    addressError,
    noRoutesError,
    refetchDeposits,
    retry,
  ])

  return (
    // min-h-full, not h-full: with a fixed height, overflowing content
    // scrolls past the padding box and pb-6 never lands after the last row
    // (the "Past deposits" row hits the bottom edge). min-h keeps short
    // content filling the viewport while letting tall content grow so the
    // bottom padding is honoured.
    <div className="zd:flex zd:min-h-full zd:w-full zd:flex-col zd:items-center zd:gap-4 zd:pt-4 zd:pb-6">
      <Text className="zd:w-full zd:text-center">{SUBTITLE}</Text>

      {/* Fiat onramp entry (Figma 20400:2504) — config-gated: only partners
          with a KYB-approved Transak key show it, and it stays visually
          secondary to the core copy-address flow. Disabled until the deposit
          address exists since that's where the purchase is delivered. */}
      {config.onramp && (
        <>
          <BuyWithCardButton
            onClick={() => setOnrampOpen(true)}
            disabled={!address}
          />
          <OnrampSheet
            open={onrampOpen}
            onOpenChange={setOnrampOpen}
            src={buildTransakUrl({
              apiKey: config.onramp.transakApiKey,
              environment: config.onramp.environment,
              // SSR-safe: undefined on the server, resolved by hydration —
              // the sheet (and its iframe) only mounts on click anyway.
              referrerDomain:
                typeof window !== 'undefined'
                  ? window.location.origin
                  : undefined,
              walletAddress: address,
              cryptoCurrencyCode: tokenSymbol,
              chainId: source?.chain.id,
            })}
          />
        </>
      )}

      <div className="zd:relative zd:flex zd:w-full zd:flex-1 zd:flex-col zd:gap-2">
        <ArrowCardPair
          topCard={
            <Wrapper
              variant="ghost"
              className="zd:relative zd:flex zd:w-full zd:flex-col zd:rounded-2xl zd:p-1"
            >
              <CardTitle>Send</CardTitle>
              <PillRow
                left={
                  <Select
                    value={selectedTokenType ?? ''}
                    onValueChange={(id) =>
                      setSelectedTokenType(id as TOKEN_TYPE)
                    }
                    disabled={pickerDisabled}
                  >
                    <SelectTrigger asChild>
                      <Pill
                        label={tokenSymbol ?? ''}
                        {...(tokenLogo && { logoUri: tokenLogo })}
                        disabled={pickerDisabled}
                        loading={!tokenSymbol}
                        trailingIcon={!pickerDisabled && <SelectIcon />}
                      />
                    </SelectTrigger>
                    <SelectContent align="start" style={FULL_ROW_PANEL_STYLE}>
                      {uniqueTokens.map((token, i) => {
                        const symbol = getSourceTokenSymbol(token)
                        const chainCount = srcTokens.filter(
                          (t) => t.tokenType === token.tokenType,
                        ).length
                        const logo = TOKEN_ICONS[symbol.toUpperCase()]
                        return (
                          <SelectItem
                            key={token.tokenType}
                            value={token.tokenType}
                            textValue={symbol}
                            className="zd:p-0"
                          >
                            <TokenListItem
                              symbol={symbol}
                              subtitle={`${chainCount} network${chainCount === 1 ? '' : 's'}`}
                              {...(logo && { imageSource: logo })}
                            />
                            {i === 0 && (
                              <span className="zd:absolute zd:top-1/2 zd:right-3 zd:-translate-y-1/2 zd:inline-flex zd:items-center zd:rounded-full zd:bg-positive/15 zd:px-2 zd:py-1 zd:text-body3 zd:text-positive zd:pointer-events-none">
                                Recommended
                              </span>
                            )}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                }
                right={
                  <Select
                    value={
                      selectedChainId !== null ? String(selectedChainId) : ''
                    }
                    onValueChange={(id) => setSelectedChainId(Number(id))}
                    disabled={pickerDisabled}
                  >
                    <SelectTrigger asChild>
                      <Pill
                        label={sourceChainName ?? ''}
                        {...(sourceChainLogo && { logoUri: sourceChainLogo })}
                        disabled={pickerDisabled}
                        loading={!sourceChainName}
                        trailingIcon={!pickerDisabled && <SelectIcon />}
                      />
                    </SelectTrigger>
                    <SelectContent align="end" style={FULL_ROW_PANEL_STYLE}>
                      {availableChains.map((token) => {
                        const logo = CHAIN_ICONS[token.chain.id]
                        return (
                          <SelectItem
                            key={token.chain.id}
                            value={String(token.chain.id)}
                            textValue={token.chain.name}
                            className="zd:p-0"
                          >
                            <TokenListItem
                              symbol={token.chain.name}
                              iconVariant="network"
                              {...(logo && { imageSource: logo })}
                            />
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                }
              />
              <div className="zd:flex zd:w-full zd:flex-col zd:items-start zd:gap-2 zd:px-2 zd:py-4">
                <DataRow
                  label="Max slippage"
                  value={slippage}
                  info
                  infoTooltip={FEE_INFO.maxSlippage}
                  trailing={
                    breakdown?.provider &&
                    PROVIDER_ICONS[breakdown.provider] ? (
                      <LiveValue
                        loading={providerFees.loading}
                        flashKey={breakdown.provider}
                      >
                        <Tooltip content={`Quoted via ${breakdown.provider}`}>
                          <button
                            type="button"
                            aria-label={`Quoted via ${breakdown.provider}`}
                            className="zd:inline-flex zd:items-center zd:justify-center zd:cursor-help zd:outline-none zd:bg-transparent"
                          >
                            <img
                              src={PROVIDER_ICONS[breakdown.provider]}
                              alt=""
                              aria-hidden
                              className="zd:size-4 zd:shrink-0 zd:rounded-[4px] zd:object-cover"
                            />
                          </button>
                        </Tooltip>
                      </LiveValue>
                    ) : null
                  }
                />
                <DataRow
                  label="Estimated fee"
                  value={
                    breakdown ? (
                      // The whole value (summary + chevron) toggles the
                      // breakdown, not just the arrow.
                      <FeeDisclosureButton
                        open={feeOpen}
                        onToggle={() => setFeeOpen((prev) => !prev)}
                      >
                        <LiveValue
                          loading={providerFees.loading}
                          flashKey={feeFlashKey}
                        >
                          <FeeSummary breakdown={breakdown} />
                        </LiveValue>
                      </FeeDisclosureButton>
                    ) : (
                      // Match Min deposit's skeleton so both loading
                      // affordances share one visual language.
                      <div className="zd:h-3.5 zd:w-20 zd:rounded-md zd:bg-greyScale/15 zd:animate-skel-pulse" />
                    )
                  }
                  info
                  infoTooltip={FEE_INFO.estimatedFee}
                />
                {feeOpen && breakdown && (
                  <FeeBreakdownRows breakdown={breakdown} />
                )}
              </div>
            </Wrapper>
          }
          bottomCard={
            <Wrapper
              variant="ghost"
              className="zd:relative zd:flex zd:w-full zd:flex-col zd:gap-2 zd:rounded-2xl zd:p-1"
            >
              <CardTitle>Arrives as</CardTitle>
              <PillRow
                left={
                  <Pill
                    label={tokenSymbol ?? ''}
                    {...(tokenLogo && { logoUri: tokenLogo })}
                    disabled
                    loading={!tokenSymbol}
                  />
                }
                right={
                  <Pill
                    label={destChain.name}
                    {...(destChainLogo && { logoUri: destChainLogo })}
                    disabled
                    loading={!tokenSymbol}
                  />
                }
              />
              <div className="zd:flex zd:w-full zd:flex-col zd:items-start zd:px-2">
                <DataRow
                  label="Ready in"
                  value={fillTime}
                  info
                  infoTooltip={FEE_INFO.readyIn}
                />
              </div>
              <AddressDisplay
                status={addressState.status}
                address={address}
                onQrClick={onQrClick}
              />
              {address && <CopyAddressButton address={address} />}
              {errorMessage && (
                <ErrorRetryCard
                  message={errorMessage}
                  onRetry={handleRetry}
                  busy={retrying}
                />
              )}
              <DataRow
                label="Min deposit"
                value={
                  minDepositAmount ?? (
                    // Match PillSkeleton's greyish pulse so all loading
                    // affordances in this card share one visual language.
                    // `<output>` gets an implicit `role="status"` — biome's
                    // `useSemanticElements` prefers it over `<div role>`.
                    // `aria-busy` + `aria-label` so screen readers hear
                    // "loading" instead of landing on an empty region.
                    <output
                      aria-busy="true"
                      aria-label="Loading minimum deposit"
                      className="zd:block zd:h-3.5 zd:w-20 zd:rounded-md zd:bg-greyScale/15 zd:animate-skel-pulse"
                    />
                  )
                }
                info
                infoTooltip={FEE_INFO.minDeposit}
                variant="warning"
              />
            </Wrapper>
          }
        />

        {/* Deposit watching only makes sense once the address exists —
            while creation is loading (or failed) there is nothing to watch,
            so neither card renders. */}
        {address &&
          (newDeposits.length > 0 ? (
            <PendingDeposits
              deposits={newDeposits}
              estimatedFees={estimatedFees}
              config={config}
              {...(onSelectDeposit && { onSelectDeposit })}
            />
          ) : (
            <LoadingCard
              text={
                source
                  ? `Watching for your deposit on ${source.chain.name}…`
                  : 'Watching for your deposit…'
              }
            />
          ))}

        {pastDepositsCount > 0 &&
          (onViewPastDeposits ? (
            <WrappedPressable
              onClick={onViewPastDeposits}
              className={cn('zd:w-full', PAST_DEPOSITS_CARD)}
            >
              <PastDepositsRow count={pastDepositsCount} />
            </WrappedPressable>
          ) : (
            <Wrapper
              variant="ghost"
              className={cn(
                'zd:flex zd:w-full zd:items-center',
                PAST_DEPOSITS_CARD,
              )}
            >
              <PastDepositsRow count={pastDepositsCount} />
            </Wrapper>
          ))}
      </div>
    </div>
  )
}

/**
 * Full-width dark "Copy Address" pill under the address row (Figma
 * `20002:36049`) — react-ui's small primary `Button`. Label flips to
 * "Copied!" for 2s as tap feedback (the design has no pressed state).
 */
function CopyAddressButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can reject on insecure contexts / denied permission —
      // keep the label unchanged rather than claim a copy happened.
    }
  }

  return (
    <Button
      size="sm"
      className="zd:w-full zd:shrink-0"
      text={copied ? 'Copied!' : 'Copy Address'}
      iconName="copy"
      trailIcon
      onClick={handleCopy}
    />
  )
}

// Past-deposits card treatment (Figma 20002:36111): 16px radius plus the
// universal inner shadow; border/blur/tint come from the ghost Wrapper.
const PAST_DEPOSITS_CARD =
  'zd:rounded-2xl zd:shadow-[inset_0_-4px_4px_0_rgba(255,255,255,0.1),inset_0_3px_4px_0_rgba(0,0,0,0.02)]'

/** Row content shared by the tappable and inert past-deposits variants. */
function PastDepositsRow({ count }: { count: number }) {
  return (
    <div className="zd:flex zd:w-full zd:items-center zd:gap-3 zd:p-4">
      <div className="zd:flex zd:min-w-0 zd:flex-1 zd:items-center zd:gap-2">
        <Icon
          name="clockFill"
          className="zd:size-4 zd:shrink-0 zd:text-solarOrange"
          aria-hidden
        />
        <Text className="zd:flex-1 zd:text-left zd:text-h3">
          Past deposits ({count})
        </Text>
      </div>
      <Icon
        name="chevronRight"
        className="zd:size-4.5 zd:shrink-0 zd:text-greyScale"
        aria-hidden
      />
    </div>
  )
}

function CardTitle({ children }: { children: string }) {
  return (
    <div className={cn('zd:flex zd:items-center zd:px-2 zd:py-3')}>
      <Text className="zd:whitespace-nowrap zd:text-h3">{children}</Text>
    </div>
  )
}

function PillRow({
  left,
  right,
}: {
  left: React.ReactNode
  right: React.ReactNode
}) {
  return (
    <div className="zd:flex zd:w-full zd:items-start zd:gap-1">
      <div className="zd:min-w-0 zd:flex-1">{left}</div>
      <div className="zd:min-w-0 zd:flex-1">{right}</div>
    </div>
  )
}
