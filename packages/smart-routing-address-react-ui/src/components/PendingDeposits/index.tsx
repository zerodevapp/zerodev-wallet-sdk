import { cn, Text } from '@zerodev/react-ui'
import type { DepositedToken } from '@zerodev/smart-routing-address'
import { CHAIN_ICONS, TOKEN_ICONS } from '../../iconAssets'
import type {
  DepositStage,
  EstimatedFee,
  SmartRoutingAddressConfig,
} from '../../types'
import {
  getDestTokenSymbol,
  getSourceTokenSymbol,
  resolveDestChain,
  sourceTokensFromFees,
} from '../../utils/config'
import { getDepositStage } from '../../utils/deposits'
import { findFeeDataByToken } from '../../utils/fees'
import {
  formatDisplayAmount,
  formatRelativeTime,
  truncateAddress,
} from '../../utils/format'
import { TxnItem, type TxnStatus } from '../TxnItem'

/** `DepositedToken` with the optional `createdAt` some SRA servers ship. */
type DepositWithTimestamp = DepositedToken & { createdAt?: string }

export interface PendingDepositsProps {
  deposits: DepositedToken[]
  estimatedFees: EstimatedFee[]
  config: SmartRoutingAddressConfig
  className?: string
}

const STAGE_TO_STATUS: Record<DepositStage, TxnStatus> = {
  pending: 'Detected',
  bridging: 'Routing',
  completed: 'Received',
  failed: 'Failed',
}

export function PendingDeposits({
  deposits,
  estimatedFees,
  config,
  className,
}: PendingDepositsProps) {
  if (deposits.length === 0) return null

  const destChain = resolveDestChain(config)
  const destChainLogo = CHAIN_ICONS[destChain.id]

  return (
    <section
      aria-label="Pending deposits"
      className={cn(
        // Plain div (not Wrapper) so we skip `backdrop-blur-[15px]`. Nesting
        // Wrapper's blur under PairMark's own `backdrop-blur-[30px]` composites
        // through an already-blurred layer and washes the frost out — bypassing
        // it here lets each PairMark sample the amorphic gradient directly.
        'zd:relative zd:flex zd:w-full zd:flex-col zd:gap-2 zd:overflow-hidden zd:rounded-2xl zd:p-4',
        'zd:border-offWhite zd:border-[0.3px] zd:bg-white/20',
        'zd:shadow-[inset_0_-4px_4px_0_rgba(255,255,255,0.1),inset_0_3px_4px_0_rgba(0,0,0,0.02)]',
        className,
      )}
    >
      <Text className="zd:text-h3">Pending Deposit</Text>
      <ul className="zd:flex zd:w-full zd:flex-col">
        {deposits.map((raw) => {
          const deposit = raw as DepositWithTimestamp
          const { chainId, token, amount, transactionHash } = deposit.deposit
          const feeData = findFeeDataByToken(estimatedFees, chainId, token)

          // Source pair: reconstruct the SourceToken so we can look up its
          // symbol + chain icon the same way the trigger pill does.
          const source =
            sourceTokensFromFees(estimatedFees).find(
              (t) => t.chain.id === chainId && t.tokenType === feeData?.name,
            ) ?? null
          const sourceSymbol = source ? getSourceTokenSymbol(source) : ''
          const sourceTokenLogo = sourceSymbol
            ? TOKEN_ICONS[sourceSymbol.toUpperCase()]
            : undefined
          const sourceChainLogo = CHAIN_ICONS[chainId]

          const destSymbol = getDestTokenSymbol(config)
          const destTokenLogo = destSymbol
            ? TOKEN_ICONS[destSymbol.toUpperCase()]
            : undefined

          const status = STAGE_TO_STATUS[getDepositStage(deposit)]
          const amountLabel = feeData
            ? `${formatDisplayAmount(amount, feeData.decimal, 'down')} ${sourceSymbol}`
            : String(amount)
          const timestamp = deposit.createdAt
            ? (formatRelativeTime(deposit.createdAt) ?? '')
            : ''

          // Block-explorer URL for the source-chain deposit tx. viem's chain
          // objects ship `blockExplorers.default.url`; fall through to
          // omitting `href` when the chain doesn't advertise one.
          const explorerBase = source?.chain.blockExplorers?.default?.url
          const href = explorerBase
            ? `${explorerBase}/tx/${transactionHash}`
            : undefined

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
                {...(destTokenLogo && { destTokenIconUrl: destTokenLogo })}
                {...(destChainLogo && { destChainIconUrl: destChainLogo })}
              />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
