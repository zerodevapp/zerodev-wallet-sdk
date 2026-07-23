import { cn, PoweredBy, Text } from '@zerodev/react-ui'
import type { DepositedToken } from '@zerodev/smart-routing-address'
import { useMemo } from 'react'
import { TxnItem, type TxnStatus } from '../components/TxnItem'
import { useSmartRoutingAddressContext } from '../context/SmartRoutingAddressContext'
import { useDepositStatus } from '../hooks/useDepositStatus'
import { CHAIN_ICONS, TOKEN_ICONS } from '../iconAssets'
import type { DepositStage } from '../types'
import {
  getDestTokenSymbol,
  getSourceTokenSymbol,
  resolveBaseUrl,
  resolveDestChain,
  resolvePollingInterval,
  sourceTokensFromFees,
} from '../utils/config'
import { getDepositStage } from '../utils/deposits'
import { findFeeDataByToken } from '../utils/fees'
import {
  formatDisplayAmount,
  formatRelativeTime,
  truncateAddress,
} from '../utils/format'

const STAGE_TO_STATUS: Record<DepositStage, TxnStatus> = {
  pending: 'Detected',
  bridging: 'Routing',
  completed: 'Received',
  failed: 'Failed',
}

/** `DepositedToken` with the optional `createdAt` some SRA servers ship. */
type DepositWithTimestamp = DepositedToken & { createdAt?: string }

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

/**
 * Past deposits view — full history, grouped by day, newest first. Each row
 * is a `TxnItem`; layout matches the deposit's `PendingDeposits` card so the
 * two views share one visual language.
 */
export function PastDeposits() {
  const { config, addressState } = useSmartRoutingAddressContext()

  const success = addressState.status === 'success' ? addressState : null
  const address = success?.address
  const estimatedFees = success?.estimatedFees ?? []

  const { deposits } = useDepositStatus({
    address,
    pollingInterval: resolvePollingInterval(config),
    baseUrl: resolveBaseUrl(config),
  })

  const destChain = resolveDestChain(config)
  const destChainLogo = CHAIN_ICONS[destChain.id]
  const destSymbol = getDestTokenSymbol(config)
  const destTokenLogo = destSymbol
    ? TOKEN_ICONS[destSymbol.toUpperCase()]
    : undefined

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
        {deposits.length === 0 ? (
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
                    const source =
                      sourceTokensFromFees(estimatedFees).find(
                        (t) =>
                          t.chain.id === chainId &&
                          t.tokenType === feeData?.name,
                      ) ?? null
                    const sourceSymbol = source
                      ? getSourceTokenSymbol(source)
                      : ''
                    const sourceTokenLogo = sourceSymbol
                      ? TOKEN_ICONS[sourceSymbol.toUpperCase()]
                      : undefined
                    const sourceChainLogo = CHAIN_ICONS[chainId]
                    const amountLabel = feeData
                      ? `${formatDisplayAmount(amount, feeData.decimal, 'down')} ${sourceSymbol}`
                      : String(amount)
                    const timestamp = deposit.createdAt
                      ? (formatRelativeTime(deposit.createdAt) ?? '')
                      : ''
                    const explorerBase =
                      source?.chain.blockExplorers?.default?.url
                    const href = explorerBase
                      ? `${explorerBase}/tx/${transactionHash}`
                      : undefined
                    const status = STAGE_TO_STATUS[getDepositStage(deposit)]

                    return (
                      <li key={transactionHash}>
                        <TxnItem
                          amount={amountLabel}
                          address={truncateAddress(transactionHash)}
                          {...(href && { href })}
                          timestamp={timestamp}
                          status={status}
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
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>

      <PoweredBy className="zd:justify-center" />
    </div>
  )
}
