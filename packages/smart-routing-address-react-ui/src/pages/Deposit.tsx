import {
  ArrowCardPair,
  cn,
  DataRow,
  Icon,
  PoweredBy,
  Text,
  Wrapper,
} from '@zerodev/react-ui'
import { useMemo } from 'react'
import { AddressDisplay } from '../components/AddressDisplay'
import { LoadingCard } from '../components/LoadingCard'
import { TokenChainPill } from '../components/TokenChainPill'
import { useSmartRoutingAddressContext } from '../context/SmartRoutingAddressContext'
import { useDepositStatus } from '../hooks/useDepositStatus'
import { useNewDeposits } from '../hooks/useNewDeposits'
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
  // First-available fallback until the interactive picker Figma is wired.
  const source = srcTokens[0] ?? null

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

  const estimatedFee = feeData
    ? `${formatDisplayAmount(feeData.fee, feeData.decimal, 'up')} ${sourceSymbol}`
    : '—'

  const minDepositAmount =
    feeData && sourceSymbol
      ? `${formatDisplayAmount(feeData.minDeposit, feeData.decimal, 'up')} ${sourceSymbol}`
      : null

  // Undefined until fee estimates arrive — the pill and loading card fall
  // back to placeholders rather than mislabelling the source slot with the
  // destination chain's name.
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
                  <TokenChainPill
                    label={sourceSymbol ?? '—'}
                    logoBg="#2775CA"
                    onClick={() => {
                      /* picker — deferred */
                    }}
                  />
                }
                right={
                  <TokenChainPill
                    label={sourceChainName ?? '—'}
                    logoBg="#0052FF"
                    onClick={() => {
                      /* picker — deferred */
                    }}
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
                  <TokenChainPill
                    label={destSymbol}
                    logoBg="#2775CA"
                    disabled
                  />
                }
                right={
                  <TokenChainPill
                    label={destChain.name}
                    logoBg="#28A0F0"
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
            sourceChainName
              ? `Watching for your deposit on ${sourceChainName}…`
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

/** Two token/chain pills side by side, matching Figma's 162px + flex layout. */
function PillRow({
  left,
  right,
}: {
  left: React.ReactNode
  right: React.ReactNode
}) {
  return (
    <div className="zd:flex zd:w-full zd:items-start zd:gap-1">
      <div style={{ width: 162, flexShrink: 0 }}>{left}</div>
      <div className="zd:min-w-px zd:flex-1">{right}</div>
    </div>
  )
}
