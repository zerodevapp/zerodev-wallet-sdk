import {
  ArrowCardPair,
  cn,
  DataRow,
  Icon,
  PillItem,
  PoweredBy,
  SelectDropdown,
  type SelectDropdownItem,
  Text,
  Wrapper,
} from '@zerodev/react-ui'
import type { TOKEN_TYPE } from '@zerodev/smart-routing-address'
import { useEffect, useMemo, useState } from 'react'
import { AddressDisplay } from '../components/AddressDisplay'
import { LoadingCard } from '../components/LoadingCard'
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

export interface DepositProps {
  onQrClick?: () => void
}

const SUBTITLE =
  "Send any supported token from any network. We'll swap & bridge it directly to your account, ready to use."

// Placeholder colors for the pill logos until we wire real token/chain logos
// in. Kept here so both the trigger and the dropdown rows agree.
const TOKEN_LOGO_BG = '#2775CA'
const CHAIN_LOGO_BG = '#0052FF'
const DEST_CHAIN_LOGO_BG = '#28A0F0'

export function Deposit({ onQrClick }: DepositProps) {
  const { config, addressState } = useSmartRoutingAddressContext()

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
  useNewDeposits(deposits, hasLoaded)

  const destChain = resolveDestChain(config)
  const destSymbol = source ? getDestTokenSymbol(config, source) : undefined
  const sourceSymbol = source ? getSourceTokenSymbol(source) : undefined
  const feeData = source
    ? findFeeData(estimatedFees, source.chain.id, source.tokenType)
    : null
  const fillTime = formatDuration(
    resolveFillTimeSeconds(config, source?.chain.id ?? destChain.id),
  )

  // Token dropdown items — one row per distinct routable token type. The row
  // subtitle reports how many chains carry that token; the first item is the
  // "recommended" default (matches Figma's green Recommended badge on USDC).
  const tokenItems = useMemo<SelectDropdownItem[]>(() => {
    const seen = new Set<TOKEN_TYPE>()
    const uniqueTokens: SourceToken[] = []
    for (const token of srcTokens) {
      if (seen.has(token.tokenType)) continue
      seen.add(token.tokenType)
      uniqueTokens.push(token)
    }
    return uniqueTokens.map((token, i) => {
      const symbol = getSourceTokenSymbol(token)
      const chainCount = srcTokens.filter(
        (t) => t.tokenType === token.tokenType,
      ).length
      return {
        id: token.tokenType,
        symbol,
        subtitle: `${chainCount} network${chainCount === 1 ? '' : 's'}`,
        logoBg: TOKEN_LOGO_BG,
        ...(i === 0 && { badge: 'Recommended' }),
      }
    })
  }, [srcTokens])

  // Chain dropdown items — chains that carry the currently-selected token.
  const chainItems = useMemo<SelectDropdownItem[]>(() => {
    if (!selectedTokenType) return []
    const seen = new Set<number>()
    const chains: SourceToken[] = []
    for (const token of srcTokens) {
      if (token.tokenType !== selectedTokenType) continue
      if (seen.has(token.chain.id)) continue
      seen.add(token.chain.id)
      chains.push(token)
    }
    return chains.map((token) => ({
      id: String(token.chain.id),
      symbol: token.chain.name,
      logoBg: CHAIN_LOGO_BG,
    }))
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

  const pickerDisabled = tokenItems.length === 0

  // Both dropdown panels span the full width of the two pills together
  // (Figma's "Send" row layout), not just the trigger cell each SelectDropdown
  // lives in. Each pill trigger is half the row minus half the 4px gap, so
  // the panel width = trigger*2 + 4px.
  const fullRowPanelWidth = 'calc(var(--radix-popover-trigger-width) * 2 + 4px)'

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
                  <SelectDropdown
                    items={tokenItems}
                    value={selectedTokenType ?? ''}
                    onChange={(id) => setSelectedTokenType(id as TOKEN_TYPE)}
                    disabled={pickerDisabled}
                    align="start"
                    panelWidth={fullRowPanelWidth}
                  />
                }
                right={
                  <SelectDropdown
                    items={chainItems}
                    value={
                      selectedChainId !== null ? String(selectedChainId) : ''
                    }
                    onChange={(id) => setSelectedChainId(Number(id))}
                    disabled={pickerDisabled}
                    align="end"
                    panelWidth={fullRowPanelWidth}
                  />
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
                  <PillItem
                    label={destSymbol ?? '—'}
                    logoBg={TOKEN_LOGO_BG}
                    disabled
                  />
                }
                right={
                  <PillItem
                    label={destChain.name}
                    logoBg={DEST_CHAIN_LOGO_BG}
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
              {minDepositAmount && (
                <DataRow
                  label="Minimum deposit"
                  value={minDepositAmount}
                  info
                  variant="warning"
                />
              )}
            </Wrapper>
          }
        />

        <LoadingCard
          text={
            source
              ? `Watching for your deposit on ${source.chain.name}…`
              : 'Watching for your deposit…'
          }
        />
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
