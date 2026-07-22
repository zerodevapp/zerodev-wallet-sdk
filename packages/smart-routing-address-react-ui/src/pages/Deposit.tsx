import {
  ArrowCardPair,
  cn,
  DataRow,
  Icon,
  Pill,
  PoweredBy,
  Select,
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectTrigger,
  Text,
  TokenListItem,
  Wrapper,
} from '@zerodev/react-ui'
import type { TOKEN_TYPE } from '@zerodev/smart-routing-address'
import { useEffect, useMemo, useState } from 'react'
import { AddressDisplay } from '../components/AddressDisplay'
import { LoadingCard } from '../components/LoadingCard'
import { PendingDeposits } from '../components/PendingDeposits'
import { useSmartRoutingAddressContext } from '../context/SmartRoutingAddressContext'
import { useDepositStatus } from '../hooks/useDepositStatus'
import { useNewDeposits } from '../hooks/useNewDeposits'
import { CHAIN_ICONS, TOKEN_ICONS } from '../iconAssets'
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
import { findFeeData, resolveTokenAddress } from '../utils/fees'
import {
  formatDisplayAmount,
  formatDuration,
  formatSlippage,
} from '../utils/format'

export interface DepositProps {
  onQrClick?: () => void
}

const SUBTITLE =
  "Send any supported token from any network. We'll swap & bridge it directly to your account, ready to use."

// The two picker panels span the full pill row (Figma "Send" layout), not
// just the trigger cell each Select lives in. Trigger width = half the row
// minus half the 4px gap, so full-row width = trigger * 2 + 4px.
const FULL_ROW_PANEL_STYLE = {
  width: 'calc(var(--radix-select-trigger-width) * 2 + 4px)',
}

export function Deposit({ onQrClick }: DepositProps) {
  const { config, addressState, setActiveRoute } =
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

  const { deposits, hasLoaded } = useDepositStatus({
    address,
    pollingInterval: resolvePollingInterval(config),
    baseUrl: resolveBaseUrl(config),
  })
  const newDeposits = useNewDeposits(deposits, hasLoaded)
  const pastDepositsCount = deposits.length - newDeposits.length

  const destChain = resolveDestChain(config)
  const destSymbol = getDestTokenSymbol(config)
  const sourceSymbol = source ? getSourceTokenSymbol(source) : undefined
  const sourceTokenLogo = sourceSymbol
    ? TOKEN_ICONS[sourceSymbol.toUpperCase()]
    : undefined
  const sourceChainLogo = source ? CHAIN_ICONS[source.chain.id] : undefined
  const destTokenLogo = destSymbol
    ? TOKEN_ICONS[destSymbol.toUpperCase()]
    : undefined
  const destChainLogo = CHAIN_ICONS[destChain.id]
  const feeData = source
    ? findFeeData(estimatedFees, source.chain.id, source.tokenType)
    : null
  const fillTime = formatDuration(
    resolveFillTimeSeconds(config, source?.chain.id ?? destChain.id),
  )

  // Publish the current picker selection so hosts (e.g. a demo "send" panel)
  // can mirror the widget's route. Cleared when the picker is empty so
  // downstream mocks show their fallback instead of stale state.
  useEffect(() => {
    if (!source || !feeData || !sourceSymbol) {
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
      symbol: sourceSymbol,
      decimals: feeData.decimal,
      feeAmount: feeData.fee,
    })
  }, [source, feeData, sourceSymbol, setActiveRoute])

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

  const slippage =
    typeof config.slippage === 'number' ? formatSlippage(config.slippage) : '—'

  const estimatedFee =
    feeData && sourceSymbol
      ? `${formatDisplayAmount(feeData.fee, feeData.decimal, 'up')} ${sourceSymbol}`
      : '—'

  const minDepositAmount =
    feeData && sourceSymbol
      ? `${formatDisplayAmount(feeData.minDeposit, feeData.decimal, 'up')} ${sourceSymbol}`
      : null

  const pickerDisabled = uniqueTokens.length === 0
  const sourceChainName = source?.chain.name

  return (
    <div className="zd:flex zd:h-full zd:w-full zd:flex-col zd:items-center zd:gap-4 zd:pt-4 zd:pb-6">
      <Text className="zd:w-full zd:text-center">{SUBTITLE}</Text>

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
                        label={sourceSymbol ?? ''}
                        {...(sourceTokenLogo && { logoUri: sourceTokenLogo })}
                        disabled={pickerDisabled}
                        loading={!sourceSymbol}
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
                <DataRow label="Max slippage" value={slippage} info />
                <DataRow
                  label="Estimated fee"
                  value={estimatedFee}
                  info
                  trailing={
                    <Icon
                      name="chevronDown"
                      className="zd:w-3.5 zd:h-3.5 zd:text-greyScale"
                    />
                  }
                />
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
                    label={destSymbol ?? ''}
                    {...(destTokenLogo && { logoUri: destTokenLogo })}
                    disabled
                    loading={!destSymbol}
                  />
                }
                right={
                  <Pill
                    label={destChain.name}
                    {...(destChainLogo && { logoUri: destChainLogo })}
                    disabled
                  />
                }
              />
              <div className="zd:flex zd:w-full zd:flex-col zd:items-start zd:px-2">
                <DataRow label="Ready in" value={fillTime} info />
              </div>
              <AddressDisplay
                status={addressState.status}
                address={address}
                onQrClick={onQrClick}
              />
              <DataRow
                label="Minimum deposit"
                value={
                  minDepositAmount ?? (
                    // Match PillSkeleton's greyish pulse so all loading
                    // affordances in this card share one visual language.
                    <div className="zd:h-3.5 zd:w-20 zd:rounded-md zd:bg-greyScale/15 zd:animate-skel-pulse" />
                  )
                }
                info
                variant="warning"
              />
            </Wrapper>
          }
        />

        {newDeposits.length > 0 ? (
          <PendingDeposits
            deposits={newDeposits}
            estimatedFees={estimatedFees}
            config={config}
          />
        ) : (
          <LoadingCard
            text={
              source
                ? `Watching for your deposit on ${source.chain.name}…`
                : 'Watching for your deposit…'
            }
          />
        )}

        {pastDepositsCount > 0 && (
          <div className="zd:flex zd:w-full zd:items-center zd:gap-2 zd:px-4 zd:py-4">
            <Icon
              name="clock"
              className="zd:size-4 zd:text-greyScale/50"
              aria-hidden
            />
            <Text className="zd:flex-1 zd:text-left zd:text-body1">
              Past deposits ({pastDepositsCount})
            </Text>
            <Icon
              name="chevronRight"
              className="zd:size-4 zd:text-greyScale/50"
              aria-hidden
            />
          </div>
        )}
      </div>

      <PoweredBy className="zd:justify-center" />
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
