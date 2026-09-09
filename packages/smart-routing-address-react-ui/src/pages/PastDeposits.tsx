import { cn, Icon, Text } from '@zerodev/react-ui'
import type { DepositedToken } from '@zerodev/smart-routing-address'
import { useMemo } from 'react'
import { TxnItem, type TxnStatus } from '../components/TxnItem'
import { useSmartRoutingAddressContext } from '../context/SmartRoutingAddressContext'
import { useDepositStatus } from '../hooks/useDepositStatus'
import { CHAIN_ICONS, TOKEN_ICONS } from '../iconAssets'
import type { DepositStage, DepositWithTimestamp } from '../types'
import { getTxUrl } from '../utils/chains'
import {
  getSourceTokenSymbol,
  resolveBaseUrl,
  resolveDestChain,
  sourceTokensFromFees,
} from '../utils/config'
import { getDepositStage } from '../utils/deposits'
import { findFeeDataByToken, tokenAddressMatches } from '../utils/fees'
import {
  formatDisplayAmount,
  formatRelativeTime,
  truncateAddress,
} from '../utils/format'

const STAGE_TO_STATUS: Record<DepositStage, TxnStatus> = {
  pending: 'Detected',
  bridging: 'Routing',
  completed: 'Delivered',
  failed: 'Failed',
}

type Group = { label: string; sortKey: number; items: DepositWithTimestamp[] }

function dayStart(timestamp: number): number {
  const d = new Date(timestamp)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function groupLabel(timestamp: number | undefined): {
  label: string
  sortKey: number
} {
  if (!timestamp) return { label: 'Recent', sortKey: -1 }
  const today = dayStart(Date.now())
  const day = dayStart(timestamp)
  if (day === today) return { label: 'Today', sortKey: today }
  if (day === today - 86_400_000) return { label: 'Yesterday', sortKey: day }
  return {
    label: new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(timestamp)),
    sortKey: day,
  }
}

function groupByDay(deposits: DepositWithTimestamp[]): Group[] {
  const buckets = new Map<string, Group>()
  for (const deposit of deposits) {
    const timestamp = deposit.createdAt
      ? Date.parse(deposit.createdAt)
      : undefined
    const { label, sortKey } = groupLabel(
      timestamp && !Number.isNaN(timestamp) ? timestamp : undefined,
    )
    const existing = buckets.get(label)
    if (existing) existing.items.push(deposit)
    else buckets.set(label, { label, sortKey, items: [deposit] })
  }
  return [...buckets.values()].sort((a, b) => b.sortKey - a.sortKey)
}

export interface PastDepositsProps {
  /** Fired when a row is tapped — the widget uses this to open the
   * transaction-details view for the selected deposit. When omitted, rows
   * render as static (non-interactive). */
  onSelectDeposit?: (deposit: DepositedToken) => void
}

/**
 * Past deposits view — full history, grouped by day, newest first. Each row
 * is a `TxnItem`; layout matches the deposit's `PendingDeposits` card so the
 * two views share one visual language.
 */
export function PastDeposits({ onSelectDeposit }: PastDepositsProps) {
  const { config, addressState } = useSmartRoutingAddressContext()

  const success = addressState.status === 'success' ? addressState : null
  const address = success?.address
  const estimatedFees = success?.estimatedFees ?? []

  const { deposits, hasLoaded } = useDepositStatus({
    address,
    baseUrl: resolveBaseUrl(config),
  })

  const destChain = resolveDestChain(config)
  const destChainLogo = CHAIN_ICONS[destChain.id]

  const groups = useMemo(
    () => groupByDay(deposits as DepositWithTimestamp[]),
    [deposits],
  )

  return (
    <div className="zd:flex zd:h-full zd:w-full zd:flex-col zd:gap-4 zd:pt-4 zd:pb-6">
      <section
        aria-label="Past deposits"
        className={cn(
          'zd:relative zd:flex zd:w-full zd:flex-1 zd:min-h-0 zd:flex-col zd:overflow-hidden zd:rounded-2xl zd:p-2',
          'zd:border-offWhite zd:border-[0.3px] zd:bg-white/20',
          'zd:shadow-[inset_0_-4px_4px_0_rgba(255,255,255,0.1),inset_0_3px_4px_0_rgba(0,0,0,0.02)]',
        )}
      >
        {!hasLoaded ? (
          <output
            aria-label="Loading past deposits"
            className="zd:flex zd:flex-1 zd:items-center zd:justify-center zd:py-8"
          >
            <Icon
              name="loading"
              className="zd:size-5 zd:animate-spin zd:text-orange"
              aria-hidden
            />
          </output>
        ) : deposits.length === 0 ? (
          <div className="zd:flex zd:flex-1 zd:items-center zd:justify-center zd:py-8">
            <Text className="zd:text-greyScale/50">No deposits yet</Text>
          </div>
        ) : (
          <div className="zd:flex zd:flex-1 zd:flex-col zd:gap-1 zd:overflow-y-auto">
            {groups.map((group) => (
              <section key={group.label} className="zd:flex zd:flex-col">
                <div className="zd:px-2 zd:py-2">
                  <Text className="zd:text-body3 zd:text-greyScale">
                    {group.label}
                  </Text>
                </div>
                <ul className="zd:flex zd:flex-col">
                  {group.items.map((deposit) => {
                    const { chainId, token, amount, transactionHash } =
                      deposit.deposit
                    const feeData = findFeeDataByToken(
                      estimatedFees,
                      chainId,
                      token,
                    )
                    // Match on the on-chain address (via `tokenAddressMatches`)
                    // — the server's `feeData.name` is a display symbol (e.g.
                    // "ETH"), not the TOKEN_TYPE ("NATIVE"), so a direct
                    // tokenType === name compare misses native tokens.
                    const source =
                      sourceTokensFromFees(estimatedFees).find(
                        (t) =>
                          t.chain.id === chainId &&
                          tokenAddressMatches(t.tokenType, chainId, token),
                      ) ?? null
                    // Prefer the reconstructed source's symbol; fall back to
                    // the server's `feeData.name` so past deposits whose route
                    // dropped out of the current fee estimates still get a
                    // symbol / icon.
                    const sourceSymbol = source
                      ? getSourceTokenSymbol(source)
                      : (feeData?.name ?? '')
                    const sourceTokenLogo = sourceSymbol
                      ? TOKEN_ICONS[sourceSymbol.toUpperCase()]
                      : undefined
                    const sourceChainLogo = CHAIN_ICONS[chainId]
                    // Destination token equals source token — widget's default
                    // actions forward the deposited asset unchanged.
                    const destTokenLogo = sourceTokenLogo
                    const amountLabel = feeData
                      ? `${formatDisplayAmount(amount, feeData.decimal, 'down')} ${sourceSymbol}`
                      : String(amount)
                    const timestamp = deposit.createdAt
                      ? (formatRelativeTime(deposit.createdAt) ?? '')
                      : ''
                    // Explorer URL from the chain id alone — independent of
                    // whether the deposit's token matched the current fees.
                    const href = getTxUrl(chainId, transactionHash)
                    const status = STAGE_TO_STATUS[getDepositStage(deposit)]
                    // Delivered amount for the detailed row headline
                    // (`amount → destAmount`). `'nearest'` rounding — the
                    // server reports the actual post-fee on-chain amount and
                    // users read this as "what I received". Falls back to the
                    // deposited amount while execution details are absent so
                    // the detailed layout stays stable across stages.
                    const destAmountLabel =
                      deposit.execution?.outputAmount && feeData
                        ? `${formatDisplayAmount(deposit.execution.outputAmount, feeData.decimal, 'nearest')} ${sourceSymbol}`
                        : amountLabel

                    const row = (
                      <TxnItem
                        amount={amountLabel}
                        destAmount={destAmountLabel}
                        address={truncateAddress(transactionHash)}
                        {...(href && { href })}
                        timestamp={timestamp}
                        status={status}
                        {...(source?.chain.name && {
                          sourceChainName: source.chain.name,
                        })}
                        destChainName={destChain.name}
                        {...(sourceTokenLogo && {
                          sourceTokenIconUrl: sourceTokenLogo,
                        })}
                        {...(sourceChainLogo && {
                          sourceChainIconUrl: sourceChainLogo,
                        })}
                        {...(destTokenLogo && {
                          destTokenIconUrl: destTokenLogo,
                        })}
                        {...(destChainLogo && {
                          destChainIconUrl: destChainLogo,
                        })}
                      />
                    )
                    return (
                      <li key={transactionHash}>
                        {onSelectDeposit ? (
                          // No padding of its own: the TxnItem's built-in
                          // p-2 (the Figma Txn Row inset) doubles as the
                          // hover highlight's breathing room. Radius matches
                          // the row's rounded-2xl.
                          <button
                            type="button"
                            onClick={() => onSelectDeposit(deposit)}
                            className="zd:w-full zd:cursor-pointer zd:rounded-2xl zd:text-left zd:hover:bg-white/30"
                          >
                            {row}
                          </button>
                        ) : (
                          row
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
