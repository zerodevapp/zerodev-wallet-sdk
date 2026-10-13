import { cn, Text } from '@zerodev/react-ui'
import type { DepositedToken } from '@zerodev/smart-routing-address'
import { CHAIN_ICONS, TOKEN_ICONS } from '../../iconAssets'
import type {
  DepositStage,
  DepositWithTimestamp,
  EstimatedFee,
  SmartRoutingAddressConfig,
} from '../../types'
import { getTxUrl } from '../../utils/chains'
import {
  getSourceTokenSymbol,
  resolveDestChain,
  sourceTokensFromFees,
} from '../../utils/config'
import { getDepositStage } from '../../utils/deposits'
import { findFeeDataByToken, tokenAddressMatches } from '../../utils/fees'
import {
  formatDisplayAmount,
  formatRelativeTime,
  truncateAddress,
} from '../../utils/format'
import { TxnItem, type TxnStatus } from '../TxnItem'

export interface PendingDepositsProps {
  deposits: DepositedToken[]
  estimatedFees: EstimatedFee[]
  config: SmartRoutingAddressConfig
  /** Fired when a row is tapped — the widget uses this to open the
   * transaction-details view for the selected deposit. When omitted, rows
   * render as static (non-interactive). */
  onSelectDeposit?: (deposit: DepositedToken) => void
  className?: string
}

const STAGE_TO_STATUS: Record<DepositStage, TxnStatus> = {
  pending: 'Detected',
  bridging: 'Routing',
  completed: 'Delivered',
  failed: 'Failed',
}

export function PendingDeposits({
  deposits,
  estimatedFees,
  config,
  onSelectDeposit,
  className,
}: PendingDepositsProps) {
  if (deposits.length === 0) return null

  const destChain = resolveDestChain(config)
  const destChainLogo = CHAIN_ICONS[destChain.id]

  return (
    <section
      aria-label="Active deposits"
      className={cn(
        // Figma 20002:36058: tighter bottom padding than top so the last
        // row's own padding doesn't double up against the card edge.
        'zd:relative zd:flex zd:w-full zd:flex-col zd:gap-4 zd:overflow-hidden zd:rounded-2xl zd:px-4 zd:pt-4 zd:pb-2',
        'zd:border-offWhite zd:border-[0.3px] zd:bg-white/20',
        'zd:shadow-[inset_0_-4px_4px_0_rgba(255,255,255,0.1),inset_0_3px_4px_0_rgba(0,0,0,0.02)]',
        className,
      )}
    >
      <Text className="zd:text-h3">Active Deposit</Text>
      <ul className="zd:flex zd:w-full zd:flex-col zd:gap-1">
        {deposits.map((raw) => {
          const deposit = raw as DepositWithTimestamp
          const { chainId, token, amount, transactionHash } = deposit.deposit
          const feeData = findFeeDataByToken(estimatedFees, chainId, token)

          // Source pair: reconstruct the SourceToken so we can look up its
          // symbol + chain icon the same way the trigger pill does. Matching
          // on the on-chain address (via `tokenAddressMatches`) — the
          // server's `feeData.name` is a display symbol (e.g. "ETH"), not the
          // TOKEN_TYPE ("NATIVE"), so a direct `t.tokenType === name` compare
          // misses native tokens.
          const source =
            sourceTokensFromFees(estimatedFees).find(
              (t) =>
                t.chain.id === chainId &&
                tokenAddressMatches(t.tokenType, chainId, token),
            ) ?? null
          // Prefer the reconstructed source's symbol; fall back to the
          // server's `feeData.name` so past deposits whose route dropped
          // out of the current fee estimates still get a symbol / icon.
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

          const status = STAGE_TO_STATUS[getDepositStage(deposit)]
          const amountLabel = feeData
            ? `${formatDisplayAmount(amount, feeData.decimal, 'down')} ${sourceSymbol}`
            : String(amount)
          const timestamp = deposit.createdAt
            ? (formatRelativeTime(deposit.createdAt) ?? '')
            : ''

          // Explorer URL from the chain id alone — independent of whether
          // the deposit's token was matched in the current fee estimates.
          const href = getTxUrl(chainId, transactionHash)

          const row = (
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
              {...(destTokenLogo && { destTokenIconUrl: destTokenLogo })}
              {...(destChainLogo && { destChainIconUrl: destChainLogo })}
            />
          )

          return (
            <li key={transactionHash}>
              {onSelectDeposit ? (
                // No padding of its own: the TxnItem's built-in p-2 (the
                // Figma Txn Row inset) doubles as the hover highlight's
                // breathing room. Radius matches the row's rounded-2xl.
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
  )
}
