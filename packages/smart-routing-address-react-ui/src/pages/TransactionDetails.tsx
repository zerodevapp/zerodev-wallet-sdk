import {
  ArrowCardPair,
  cn,
  DataRow,
  Icon,
  InfoCard,
  PoweredBy,
  Section,
  Text,
} from '@zerodev/react-ui'
import type { DepositedToken } from '@zerodev/smart-routing-address'
import { type ReactNode, useState } from 'react'
import { FeeBreakdownRows, FeeSummary } from '../components/FeeBreakdown'
import { FEE_INFO } from '../components/FeeBreakdown/feeInfo'
import { useSmartRoutingAddressContext } from '../context/SmartRoutingAddressContext'
import { CHAIN_ICONS, TOKEN_ICONS } from '../iconAssets'
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
 * Transaction details view (Figma `17634:105049`) — token hero pair via
 * `ArrowCardPair` + `InfoCard`, a "Transaction details" `Section` with the
 * route metadata, and a "Transaction Progress" `Section` with the step trail.
 */
export function TransactionDetails({ deposit }: TransactionDetailsProps) {
  const { config, addressState } = useSmartRoutingAddressContext()
  const estimatedFees =
    addressState.status === 'success' ? addressState.estimatedFees : []

  const { chainId, token, amount, transactionHash } = deposit.deposit
  const feeData = findFeeDataByToken(estimatedFees, chainId, token)

  // Match on the on-chain address (via `tokenAddressMatches`) — the server's
  // `feeData.name` is a display symbol (e.g. "ETH"), not the TOKEN_TYPE
  // ("NATIVE"), so a direct name compare would miss native tokens.
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
  const execution = deposit.execution
  const outAmountRaw = execution?.outputAmount
  const failed = stage === 'failed'

  const sourceHeadline = feeData
    ? `${formatDisplayAmount(amount, feeData.decimal, 'down')} ${sourceSymbol}`
    : String(amount)
  const sourceSecondary = feeData
    ? `${formatTokenAmount(amount, feeData.decimal)} ${sourceSymbol}`
    : undefined

  const destHeadline =
    outAmountRaw && feeData
      ? `${formatDisplayAmount(outAmountRaw, feeData.decimal, 'down')} ${destSymbol}`
      : '—'
  const destSecondary =
    outAmountRaw && feeData
      ? `${formatTokenAmount(outAmountRaw, feeData.decimal)} ${destSymbol}`
      : undefined

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
    <div className="zd:flex zd:h-full zd:w-full zd:flex-col zd:gap-3 zd:pt-4 zd:pb-6">
      <ArrowCardPair
        topCard={
          <InfoCard
            title={sourceHeadline}
            {...(sourceSecondary && { subtitle: sourceSecondary })}
            {...(sourceTokenLogo && { imageSource: sourceTokenLogo })}
            {...(sourceChainLogo && { chainIconUrl: sourceChainLogo })}
            imageStyle="filled"
          />
        }
        bottomCard={
          <InfoCard
            title={destHeadline}
            {...(destSecondary && { subtitle: destSecondary })}
            {...(destTokenLogo && { imageSource: destTokenLogo })}
            {...(destChainLogo && { chainIconUrl: destChainLogo })}
            imageStyle="filled"
          />
        }
      />

      <Section title="Transaction details">
        <DataRow
          label="From network"
          value={
            <NetworkValue
              name={sourceChain?.name ?? '—'}
              {...(sourceChainLogo && { logoUrl: sourceChainLogo })}
            />
          }
        />
        <DataRow
          label="To network"
          value={
            <NetworkValue
              name={destChain.name}
              {...(destChainLogo && { logoUrl: destChainLogo })}
            />
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
      </Section>

      <Section title="Transaction Progress">
        <ProgressStep
          label="Deposit detected"
          info={FEE_INFO.detected}
          done
          right={
            <TxLink
              label={truncateAddress(transactionHash)}
              href={sourceHref}
            />
          }
        />
        <ProgressStep
          label="Routing"
          info={FEE_INFO.routing}
          done={stage === 'bridging' || stage === 'completed'}
          right={
            breakdown?.provider ? (
              <ProviderChip provider={breakdown.provider} />
            ) : (
              <Text className="zd:text-body3 zd:text-greyScale/50">—</Text>
            )
          }
        />
        {failed ? (
          <ProgressStep
            label="Failed"
            info={FEE_INFO.failed}
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
            info={FEE_INFO.completed}
            done={stage === 'completed'}
            isLast
            right={
              execution ? (
                <TxLink
                  label={truncateAddress(execution.transactionHash)}
                  href={destHref}
                />
              ) : (
                <Text className="zd:text-body3 zd:text-greyScale/50">
                  Pending
                </Text>
              )
            }
          />
        )}
      </Section>

      <PoweredBy className="zd:mt-auto zd:justify-center zd:pt-2" />
    </div>
  )
}

function NetworkValue({ name, logoUrl }: { name: string; logoUrl?: string }) {
  return (
    <span className="zd:inline-flex zd:items-center zd:gap-1.5">
      <Text className="zd:whitespace-nowrap zd:font-medium">{name}</Text>
      {logoUrl && (
        <img src={logoUrl} alt="" className="zd:size-4 zd:rounded-full" />
      )}
    </span>
  )
}

function ProgressStep({
  label,
  info,
  done,
  failed,
  isLast,
  right,
}: {
  label: string
  info?: string | undefined
  done: boolean
  failed?: boolean
  isLast?: boolean
  right?: ReactNode
}) {
  return (
    <div className="zd:relative zd:flex zd:w-full zd:items-start zd:gap-3">
      <div className="zd:flex zd:flex-col zd:items-center zd:pt-[2px]">
        <StatusMark done={done} failed={!!failed} />
        {!isLast && (
          <div
            className={cn(
              'zd:mt-1 zd:h-4 zd:w-px',
              done ? 'zd:bg-solarOrange/60' : 'zd:bg-greyScale/20',
            )}
          />
        )}
      </div>
      <div className="zd:flex zd:min-w-0 zd:flex-1 zd:items-center zd:gap-1">
        <Text
          className={cn(
            'zd:whitespace-nowrap',
            failed ? 'zd:text-negative' : 'zd:text-greyScale',
          )}
        >
          {label}
        </Text>
        {info && (
          <span
            className="zd:inline-flex zd:items-center zd:justify-center zd:cursor-help"
            data-zd-tooltip=""
            title={info}
          >
            <Icon
              name="info"
              className="zd:w-3 zd:h-3 zd:text-greyScale/50"
              aria-hidden
            />
          </span>
        )}
      </div>
      <div className="zd:flex zd:shrink-0 zd:items-center">{right}</div>
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

function TxLink({ label, href }: { label: string; href?: string | undefined }) {
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

function ProviderChip({ provider }: { provider: string }) {
  return (
    <span
      className="zd:inline-flex zd:items-center zd:gap-1 zd:rounded-full zd:bg-greyScale/10 zd:px-2 zd:py-0.5 zd:text-body3 zd:text-greyScale"
      title={`Quoted via ${provider}`}
    >
      {provider}
    </span>
  )
}
