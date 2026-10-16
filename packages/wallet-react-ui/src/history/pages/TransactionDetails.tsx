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
  type TokenSummaryProps,
} from '@zerodev/react-ui'
import type {
  TransactionHistoryChain,
  TransactionHistoryFee,
  TransactionHistoryStatus,
  TransactionHistoryTransaction,
} from '@zerodev/wallet-data'
import { shortenHex } from '../../shared/utils/common'
import { TX_HISTORY_STATUS_COLOR } from '../components/TxHistoryItem'
import { formatDateTime, formatUsd } from '../utils/format'
import {
  assetSides,
  describeSide,
  formatAmount,
  headlineFlow,
  headlineSide,
  operationIcon,
  type SideText,
  TX_HISTORY_STATUS,
  transactionTitle,
} from '../utils/toTxHistoryEntry'

export interface TransactionDetailsProps {
  transaction: TransactionHistoryTransaction
}

export function TransactionDetails({
  transaction: tx,
}: TransactionDetailsProps) {
  const sides = assetSides(tx)
  const headline = headlineSide(sides)
  const title = transactionTitle(tx)
  const asset =
    headline && describeSide(headline, tx.operation, headlineFlow(tx, sides))
  const from = sides.from && describeSide(sides.from, tx.operation, 'out')
  const to = sides.to && describeSide(sides.to, tx.operation, 'in')
  const pair = from && to ? { from, to } : undefined
  const unnamedToken =
    headline?.kind === 'token' && !headline.token.symbol
      ? headline.token
      : undefined

  return (
    <div className="zd:flex zd:w-full zd:flex-col zd:gap-3 zd:pt-4 zd:pb-6">
      {asset && <Text className="zd:text-center zd:text-body1">{title}</Text>}
      <TokenSummary
        {...(asset
          ? heroProps(asset)
          : {
              primaryValue: title,
              tokenFallback: (
                <Icon
                  name={operationIcon(tx.operation)}
                  className="zd:size-6"
                />
              ),
            })}
        {...(tx.chain.iconUri && { badgeLogoUrl: tx.chain.iconUri })}
      />
      {pair && (
        <ArrowCardPair
          topCard={
            <SideCard side={pair.from} chainIconUri={tx.chain.iconUri} />
          }
          bottomCard={
            <SideCard side={pair.to} chainIconUri={tx.chain.iconUri} />
          }
        />
      )}

      <Section title="Transaction details">
        <DataRow label="Network" value={<ChainValue chain={tx.chain} />} />
        <DataRow label="Date" value={formatDateTime(tx.timestamp * 1000)} />
        <DataRow label="Status" value={<StatusText status={tx.status} />} />
        {unnamedToken?.address && (
          <DataRow
            label="Token"
            value={
              <span className="zd:text-body3 zd:text-greyScale">
                {shortenHex(unnamedToken.address)}
              </span>
            }
          />
        )}
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

type Hero = Pick<
  TokenSummaryProps,
  'primaryValue' | 'secondaryValue' | 'tokenLogoUrl' | 'tokenFallback'
>

/** The headline card: the token id under an NFT's name, the USD value under
 * a token amount, initials in the tile when the asset has no image. */
function heroProps(side: SideText): Hero {
  const secondary = secondaryLine(side)
  return {
    primaryValue: side.text,
    ...(secondary && { secondaryValue: secondary }),
    ...(side.imageUri
      ? { tokenLogoUrl: side.imageUri }
      : {
          tokenFallback: (
            <Text className="zd:text-body1 zd:text-greyScale">
              {side.fallback}
            </Text>
          ),
        }),
  }
}

function secondaryLine(side: SideText): string | undefined {
  if (side.detail) return side.detail
  return side.usd === undefined ? undefined : formatUsd(side.usd)
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

function formatFee(fee: TransactionHistoryFee): string {
  const value = formatAmount(fee.quantity, fee.token)
  return fee.token.priceUsd === null
    ? value
    : `${value} (${formatUsd(fee.quantity.float * fee.token.priceUsd)})`
}

function SideCard({
  side,
  chainIconUri,
}: {
  side: SideText
  chainIconUri: string | undefined
}) {
  const subtitle = secondaryLine(side)
  return (
    <InfoCard
      title={side.text}
      {...(subtitle && { subtitle })}
      {...(side.imageUri && {
        imageSource: side.imageUri,
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
