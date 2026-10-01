import {
  ArrowCardPair,
  cn,
  DataRow,
  Icon,
  InfoCard,
  ProgressStep,
  Section,
  Text,
  TokenSummary,
} from '@zerodev/react-ui'
import type {
  TransactionHistoryChain,
  TransactionHistoryFee,
  TransactionHistoryQuantity,
  TransactionHistoryStatus,
  TransactionHistoryToken,
  TransactionHistoryTransaction,
} from '@zerodev/wallet-data'
import { shortenHex } from '../../shared/utils/common'
import { TX_HISTORY_STATUS_COLOR } from '../components/TxHistoryItem'
import { formatDateTime, formatUsd } from '../utils/format'
import { formatQuantity, TX_HISTORY_STATUS } from '../utils/toTxHistoryEntry'

export interface TransactionDetailsProps {
  transaction: TransactionHistoryTransaction
}

export function TransactionDetails({
  transaction: tx,
}: TransactionDetailsProps) {
  const swap =
    tx.operation === 'swap' &&
    tx.quantity &&
    tx.token &&
    tx.destQuantity &&
    tx.destToken
      ? {
          from: { quantity: tx.quantity, token: tx.token },
          to: { quantity: tx.destQuantity, token: tx.destToken },
        }
      : undefined
  const hero =
    swap?.to ??
    (tx.quantity && tx.token
      ? { quantity: tx.quantity, token: tx.token }
      : undefined)

  return (
    <div className="zd:flex zd:w-full zd:flex-col zd:gap-3 zd:pt-4 zd:pb-6">
      {hero && (
        <TokenSummary
          primaryValue={amount(hero.quantity, hero.token)}
          {...(hero.token.priceUsd !== null && {
            secondaryValue: formatUsd(
              hero.quantity.float * hero.token.priceUsd,
            ),
          })}
          {...(hero.token.imageUri && { tokenLogoUrl: hero.token.imageUri })}
          {...(tx.chain.iconUri && { badgeLogoUrl: tx.chain.iconUri })}
        />
      )}
      {swap && (
        <ArrowCardPair
          topCard={<TokenCard {...swap.from} chainIconUri={tx.chain.iconUri} />}
          bottomCard={
            <TokenCard {...swap.to} chainIconUri={tx.chain.iconUri} />
          }
        />
      )}

      <Section title="Transaction details">
        <DataRow label="Network" value={<ChainValue chain={tx.chain} />} />
        <DataRow label="Date" value={formatDateTime(tx.timestamp * 1000)} />
        <DataRow label="Status" value={<StatusText status={tx.status} />} />
        {tx.fees?.network && (
          <DataRow label="Network fee" value={formatFee(tx.fees.network)} />
        )}
        {tx.fees?.protocol?.map((fee) => (
          <DataRow
            key={`${fee.token.address ?? fee.token.symbol}-${fee.quantity.int}`}
            label="Protocol fee"
            value={formatFee(fee)}
          />
        ))}
        <DataRow
          label="Transaction"
          value={<HashLink hash={tx.txHash} href={tx.chain.explorerTxUrl} />}
        />
      </Section>

      <Section title="Progress">
        <ProgressStep label="Submitted" status="done" />
        <ProgressStep
          label={PROGRESS_LABEL[tx.status](tx.chain.name)}
          status={PROGRESS_STATUS[tx.status]}
          isLast
          right={
            tx.chain.explorerTxUrl && (
              <HashLink hash={tx.txHash} href={tx.chain.explorerTxUrl} />
            )
          }
        />
      </Section>
    </div>
  )
}

const PROGRESS_LABEL: Record<
  TransactionHistoryStatus,
  (chain: string) => string
> = {
  success: (chain) => `Confirmed on ${chain}`,
  pending: (chain) => `Confirming on ${chain}`,
  failed: (chain) => `Failed on ${chain}`,
  unknown: () => 'Status unknown',
}

const PROGRESS_STATUS: Record<
  TransactionHistoryStatus,
  'done' | 'pending' | 'failed'
> = {
  success: 'done',
  pending: 'pending',
  failed: 'failed',
  unknown: 'pending',
}

function amount(
  quantity: TransactionHistoryQuantity,
  token: TransactionHistoryToken,
): string {
  return `${formatQuantity(quantity)} ${token.symbol ?? ''}`.trim()
}

function formatFee(fee: TransactionHistoryFee): string {
  const value = amount(fee.quantity, fee.token)
  return fee.token.priceUsd === null
    ? value
    : `${value} (${formatUsd(fee.quantity.float * fee.token.priceUsd)})`
}

function TokenCard({
  quantity,
  token,
  chainIconUri,
}: {
  quantity: TransactionHistoryQuantity
  token: TransactionHistoryToken
  chainIconUri: string | undefined
}) {
  return (
    <InfoCard
      title={amount(quantity, token)}
      {...(token.priceUsd !== null && {
        subtitle: formatUsd(quantity.float * token.priceUsd),
      })}
      {...(token.imageUri && {
        imageSource: token.imageUri,
        imageStyle: 'filled' as const,
      })}
      {...(chainIconUri && { chainIconUrl: chainIconUri })}
    />
  )
}

function StatusText({ status }: { status: TransactionHistoryStatus }) {
  const label = TX_HISTORY_STATUS[status]
  return <Text className={TX_HISTORY_STATUS_COLOR[label]}>{label}</Text>
}

function ChainValue({
  chain,
}: {
  chain: Pick<TransactionHistoryChain, 'name' | 'iconUri'>
}) {
  return (
    <span className="zd:inline-flex zd:items-center zd:gap-1.5">
      {chain.iconUri && (
        <img
          src={chain.iconUri}
          alt=""
          aria-hidden
          className="zd:size-4 zd:rounded-full zd:object-cover"
        />
      )}
      <Text>{chain.name}</Text>
    </span>
  )
}

function HashLink({ hash, href }: { hash: string; href: string | undefined }) {
  const label = shortenHex(hash)
  const className =
    'zd:inline-flex zd:items-center zd:gap-1 zd:text-body3 zd:text-greyScale'
  if (!href) return <span className={className}>{label}</span>
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(className, 'zd:hover:text-solarOrange')}
    >
      {label}
      <Icon name="export" className="zd:size-3" aria-hidden />
    </a>
  )
}
