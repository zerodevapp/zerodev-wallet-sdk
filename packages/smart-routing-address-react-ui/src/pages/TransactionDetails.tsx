import {
  ArrowCardPair,
  cn,
  DataRow,
  Icon,
  PoweredBy,
  Text,
  Wrapper,
} from '@zerodev/react-ui'
import type { DepositedToken } from '@zerodev/smart-routing-address'
import { useState } from 'react'
import { FeeBreakdownRows, FeeSummary } from '../components/FeeBreakdown'
import { FEE_INFO } from '../components/FeeBreakdown/feeInfo'
import { useSmartRoutingAddressContext } from '../context/SmartRoutingAddressContext'
import { CHAIN_ICONS, TOKEN_ICONS } from '../iconAssets'
import type { DepositStage } from '../types'
import {
  getDestTokenSymbol,
  getSourceTokenSymbol,
  resolveDestChain,
  sourceTokensFromFees,
} from '../utils/config'
import { getDepositStage } from '../utils/deposits'
import { findFeeDataByToken, tokenAddressMatches } from '../utils/fees'
import {
  formatDisplayAmount,
  formatTokenAmount,
  truncateAddress,
} from '../utils/format'
import { buildFeeBreakdown } from '../utils/providerFees'

export interface TransactionDetailsProps {
  deposit: DepositedToken & { createdAt?: string }
}

type StepKey = 'detected' | 'routing' | 'completed' | 'failed'

const STEP_ORDER: Record<Exclude<StepKey, 'failed'>, number> = {
  detected: 0,
  routing: 1,
  completed: 2,
}

function currentStep(stage: DepositStage): StepKey {
  switch (stage) {
    case 'pending':
      return 'detected'
    case 'bridging':
      return 'routing'
    case 'completed':
      return 'completed'
    case 'failed':
      return 'failed'
  }
}

function formatDate(iso?: string): string | null {
  if (!iso) return null
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return null
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ts))
}

/**
 * Transaction details view (`17634:105050`) — full breakdown of a single
 * deposit: token hero, from/to networks, date, fee, and the step trail
 * (Deposit detected → Routing → Completed).
 */
export function TransactionDetails({ deposit }: TransactionDetailsProps) {
  const { config, addressState } = useSmartRoutingAddressContext()
  const estimatedFees =
    addressState.status === 'success' ? addressState.estimatedFees : []

  const { chainId, token, amount, transactionHash } = deposit.deposit
  const feeData = findFeeDataByToken(estimatedFees, chainId, token)

  // Match on the on-chain address (via `tokenAddressMatches`) — the server's
  // `feeData.name` is a display symbol (e.g. "ETH"), not the TOKEN_TYPE
  // ("NATIVE"), so a direct tokenType === name compare misses native tokens.
  const source =
    sourceTokensFromFees(estimatedFees).find(
      (t) =>
        t.chain.id === chainId &&
        tokenAddressMatches(t.tokenType, chainId, token),
    ) ?? null
  const sourceSymbol = source ? getSourceTokenSymbol(source) : ''
  const sourceChain = source?.chain
  const sourceTokenLogo = sourceSymbol
    ? TOKEN_ICONS[sourceSymbol.toUpperCase()]
    : undefined
  const sourceChainLogo = CHAIN_ICONS[chainId]

  const destChain = resolveDestChain(config)
  const destSymbol = getDestTokenSymbol(config)
  const destTokenLogo = destSymbol
    ? TOKEN_ICONS[destSymbol.toUpperCase()]
    : undefined
  const destChainLogo = CHAIN_ICONS[destChain.id]

  const stage = getDepositStage(deposit)
  const step = currentStep(stage)
  const failed = step === 'failed'

  const sourceAmount = feeData
    ? `${formatDisplayAmount(amount, feeData.decimal, 'down')} ${sourceSymbol}`
    : String(amount)

  const execution = deposit.execution
  const outAmountRaw = execution?.outputAmount
  const destAmount =
    outAmountRaw && feeData
      ? `${formatDisplayAmount(outAmountRaw, feeData.decimal, 'down')} ${destSymbol}`
      : null

  const sourceExplorer = sourceChain?.blockExplorers?.default?.url
  const sourceHref = sourceExplorer
    ? `${sourceExplorer}/tx/${transactionHash}`
    : undefined
  const destExplorer = destChain.blockExplorers?.default?.url
  const destHref =
    execution && destExplorer
      ? `${destExplorer}/tx/${execution.transactionHash}`
      : undefined

  const breakdown =
    feeData && sourceSymbol ? buildFeeBreakdown(feeData, sourceSymbol) : null
  const [feeOpen, setFeeOpen] = useState(false)

  const date = formatDate(deposit.createdAt)

  return (
    <div className="zd:flex zd:h-full zd:w-full zd:flex-col zd:gap-4 zd:pt-4 zd:pb-6">
      <div className="zd:flex zd:w-full zd:flex-col zd:gap-2">
        <ArrowCardPair
          topCard={
            <TokenAmountCard
              amount={sourceAmount}
              secondary={
                feeData
                  ? `${formatTokenAmount(amount, feeData.decimal)} ${sourceSymbol}`
                  : undefined
              }
              tokenIconUrl={sourceTokenLogo}
              chainIconUrl={sourceChainLogo}
            />
          }
          bottomCard={
            <TokenAmountCard
              amount={destAmount ?? '—'}
              secondary={
                outAmountRaw && feeData
                  ? `${formatTokenAmount(outAmountRaw, feeData.decimal)} ${destSymbol}`
                  : undefined
              }
              tokenIconUrl={destTokenLogo}
              chainIconUrl={destChainLogo}
            />
          }
        />

        {/* Transaction details card */}
        <Wrapper
          variant="ghost"
          className="zd:relative zd:flex zd:w-full zd:flex-col zd:gap-1 zd:rounded-2xl zd:p-4"
        >
          <Text className="zd:text-h3 zd:pb-2">Transaction details</Text>
          <DataRow
            label="From network"
            value={
              <span className="zd:inline-flex zd:items-center zd:gap-1.5">
                <Text className="zd:whitespace-nowrap zd:font-medium">
                  {sourceChain?.name ?? '—'}
                </Text>
                {sourceChainLogo && (
                  <img
                    src={sourceChainLogo}
                    alt=""
                    className="zd:size-4 zd:rounded-full"
                  />
                )}
              </span>
            }
          />
          <DataRow
            label="To network"
            value={
              <span className="zd:inline-flex zd:items-center zd:gap-1.5">
                <Text className="zd:whitespace-nowrap zd:font-medium">
                  {destChain.name}
                </Text>
                {destChainLogo && (
                  <img
                    src={destChainLogo}
                    alt=""
                    className="zd:size-4 zd:rounded-full"
                  />
                )}
              </span>
            }
          />
          {date && <DataRow label="Date" value={date} />}
          {breakdown && (
            <DataRow
              label="Total fee"
              value={<FeeSummary breakdown={breakdown} />}
              info
              infoTooltip={FEE_INFO.estimatedFee}
              trailing={
                <button
                  type="button"
                  onClick={() => setFeeOpen((prev) => !prev)}
                  aria-expanded={feeOpen}
                  aria-label={feeOpen ? 'Hide fee details' : 'Show fee details'}
                  className="zd:inline-flex zd:items-center zd:justify-center zd:cursor-pointer"
                >
                  <Icon
                    name={feeOpen ? 'chevronUp' : 'chevronDown'}
                    className="zd:w-3.5 zd:h-3.5 zd:text-greyScale"
                  />
                </button>
              }
            />
          )}
          {feeOpen && breakdown && <FeeBreakdownRows breakdown={breakdown} />}
        </Wrapper>

        {/* Transaction progress card */}
        <Wrapper
          variant="ghost"
          className="zd:relative zd:flex zd:w-full zd:flex-col zd:gap-2 zd:rounded-2xl zd:p-4"
        >
          <Text className="zd:text-h3 zd:pb-2">Transaction Progress</Text>
          <ProgressStep
            label="Deposit detected"
            done
            isLast={false}
            right={
              <TxLink
                href={sourceHref}
                label={truncateAddress(transactionHash)}
              />
            }
          />
          <ProgressStep
            label="Routing"
            done={
              step === 'routing' ||
              step === 'completed' ||
              (failed && STEP_ORDER.routing <= 1)
            }
            failed={failed && stage === 'bridging'}
            isLast={false}
          />
          {failed ? (
            <ProgressStep
              label="Failed"
              done={false}
              failed
              isLast
              right={
                <Text className="zd:text-body3 zd:text-negative">Error</Text>
              }
            />
          ) : (
            <ProgressStep
              label="Completed"
              done={step === 'completed'}
              isLast
              right={
                execution ? (
                  <TxLink
                    href={destHref}
                    label={truncateAddress(execution.transactionHash)}
                  />
                ) : (
                  <Text className="zd:text-body3 zd:text-greyScale/50">
                    Pending
                  </Text>
                )
              }
            />
          )}
        </Wrapper>
      </div>

      <PoweredBy className="zd:justify-center" />
    </div>
  )
}

function TokenAmountCard({
  amount,
  secondary,
  tokenIconUrl,
  chainIconUrl,
}: {
  amount: string
  secondary?: string | undefined
  tokenIconUrl?: string | undefined
  chainIconUrl?: string | undefined
}) {
  return (
    <div className="zd:flex zd:w-full zd:items-center zd:gap-3 zd:p-3">
      <div className="zd:relative zd:size-11 zd:shrink-0">
        <div className="zd:size-full zd:overflow-hidden zd:rounded-full zd:bg-greyScale/10">
          {tokenIconUrl && (
            <img
              src={tokenIconUrl}
              alt=""
              className="zd:size-full zd:object-contain"
            />
          )}
        </div>
        {chainIconUrl && (
          <img
            src={chainIconUrl}
            alt=""
            className="zd:absolute zd:right-0 zd:bottom-0 zd:size-3.5 zd:rounded-full zd:border zd:border-white"
          />
        )}
      </div>
      <div className="zd:flex zd:min-w-0 zd:flex-1 zd:flex-col">
        <Text className="zd:text-body1 zd:font-medium zd:truncate">
          {amount}
        </Text>
        {secondary && (
          <Text className="zd:text-body3 zd:text-greyScale/50 zd:truncate">
            {secondary}
          </Text>
        )}
      </div>
    </div>
  )
}

function ProgressStep({
  label,
  done,
  failed,
  isLast,
  right,
}: {
  label: string
  done: boolean
  failed?: boolean
  isLast: boolean
  right?: React.ReactNode
}) {
  return (
    <div className="zd:relative zd:flex zd:w-full zd:items-center zd:gap-3 zd:py-1">
      <div className="zd:flex zd:flex-col zd:items-center">
        <StatusMark done={done} failed={!!failed} />
        {!isLast && (
          <div
            className={cn(
              'zd:h-4 zd:w-px',
              done ? 'zd:bg-solarOrange/40' : 'zd:bg-greyScale/15',
            )}
          />
        )}
      </div>
      <Text
        className={cn(
          'zd:flex-1',
          failed ? 'zd:text-negative' : 'zd:text-greyScale',
        )}
      >
        {label}
      </Text>
      {right}
    </div>
  )
}

function StatusMark({ done, failed }: { done: boolean; failed: boolean }) {
  if (failed) {
    return (
      <Icon name="warning" className="zd:size-4 zd:text-negative" aria-hidden />
    )
  }
  if (done) {
    return (
      <span className="zd:inline-flex zd:size-4 zd:items-center zd:justify-center zd:rounded-full zd:bg-solarOrange">
        <Icon name="check" className="zd:size-3 zd:text-white" aria-hidden />
      </span>
    )
  }
  return (
    <span className="zd:inline-block zd:size-4 zd:rounded-full zd:border zd:border-greyScale/30" />
  )
}

function TxLink({ href, label }: { href?: string | undefined; label: string }) {
  if (!href) {
    return (
      <span className="zd:inline-flex zd:items-center zd:gap-1 zd:text-body3 zd:text-greyScale">
        {label}
      </span>
    )
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="zd:inline-flex zd:items-center zd:gap-1 zd:text-body3 zd:text-greyScale zd:hover:text-solarOrange"
    >
      {label}
      <Icon
        name="export"
        className="zd:size-3 zd:text-solarOrange"
        aria-hidden
      />
    </a>
  )
}
