import { cn, Icon, Text } from '@zerodev/react-ui'

export type TxnStatus = 'Routing' | 'Detected' | 'Received' | 'Failed'

export interface TxnItemProps {
  /** Pre-formatted amount, e.g. `"$248.00 USD"`. */
  amount: string
  /** Short address/hash display, e.g. `"0x4d2a…ba99"`. */
  address: string
  /** Optional block-explorer URL. Address row becomes a link when supplied. */
  href?: string
  /** Pre-formatted relative timestamp, e.g. `"2 mo ago"`. */
  timestamp: string
  status: TxnStatus
  sourceTokenIconUrl?: string
  sourceChainIconUrl?: string
  destTokenIconUrl?: string
  destChainIconUrl?: string
  className?: string
}

const STATUS_COLOR: Record<TxnStatus, string> = {
  Routing: 'zd:text-solarOrange',
  Detected: 'zd:text-greyScale/50',
  Received: 'zd:text-positive',
  Failed: 'zd:text-negative',
}

export function TxnItem({
  amount,
  address,
  href,
  timestamp,
  status,
  sourceTokenIconUrl,
  sourceChainIconUrl,
  destTokenIconUrl,
  destChainIconUrl,
  className,
}: TxnItemProps) {
  return (
    <div
      className={cn(
        'zd:relative zd:flex zd:w-full zd:items-center zd:gap-3 zd:py-2',
        className,
      )}
    >
      <PairMarkPair
        {...(sourceTokenIconUrl && { sourceTokenIconUrl })}
        {...(sourceChainIconUrl && { sourceChainIconUrl })}
        {...(destTokenIconUrl && { destTokenIconUrl })}
        {...(destChainIconUrl && { destChainIconUrl })}
      />

      <div className="zd:flex zd:min-w-0 zd:flex-1 zd:flex-col">
        <Text className="zd:text-body2 zd:truncate">{amount}</Text>
        <AddressLine address={address} {...(href && { href })} />
      </div>

      <div className="zd:flex zd:shrink-0 zd:flex-col zd:items-end zd:gap-1">
        <Text className="zd:text-body3 zd:text-greyScale/50">{timestamp}</Text>
        <Text className={cn('zd:text-body3', STATUS_COLOR[status])}>
          {status}
        </Text>
      </div>
    </div>
  )
}

function PairMarkPair(props: {
  sourceTokenIconUrl?: string
  sourceChainIconUrl?: string
  destTokenIconUrl?: string
  destChainIconUrl?: string
}) {
  return (
    <div className="zd:flex zd:shrink-0 zd:items-center">
      <PairMark
        {...(props.sourceTokenIconUrl && {
          tokenIconUrl: props.sourceTokenIconUrl,
        })}
        {...(props.sourceChainIconUrl && {
          chainIconUrl: props.sourceChainIconUrl,
        })}
        badgeSide="left"
      />
      <PairMark
        {...(props.destTokenIconUrl && {
          tokenIconUrl: props.destTokenIconUrl,
        })}
        {...(props.destChainIconUrl && {
          chainIconUrl: props.destChainIconUrl,
        })}
        badgeSide="right"
        className="zd:-ml-4"
      />
    </div>
  )
}

function PairMark({
  tokenIconUrl,
  chainIconUrl,
  badgeSide,
  className,
}: {
  tokenIconUrl?: string
  chainIconUrl?: string
  badgeSide: 'left' | 'right'
  className?: string
}) {
  return (
    <div
      className={cn(
        // Frosted well: 60% white so the backdrop-blur has visible tint to
        // work with. `isolation-isolate` opens a fresh stacking context, so
        // the blur samples the ancestor gradient behind the SRA card
        // directly instead of the ghost Wrapper's already-blurred layer —
        // that keeps the frost readable when nested inside PendingDeposits.
        'zd:relative zd:size-11 zd:shrink-0 zd:rounded-xl zd:isolate zd:bg-white/60 zd:backdrop-blur-[30px]',
        'zd:shadow-[inset_0_3px_4px_0_rgba(0,0,0,0.02),inset_0_-4px_4px_0_rgba(255,255,255,0.1)]',
        className,
      )}
    >
      <div className="zd:absolute zd:top-1/2 zd:left-1/2 zd:size-8.5 zd:-translate-x-1/2 zd:-translate-y-1/2 zd:overflow-hidden zd:rounded-full zd:bg-greyScale/10">
        {tokenIconUrl && (
          <img
            src={tokenIconUrl}
            alt=""
            className="zd:size-full zd:object-contain"
          />
        )}
      </div>
      {chainIconUrl && (
        <div
          className={cn(
            'zd:absolute zd:bottom-1 zd:size-3 zd:overflow-hidden zd:rounded-full zd:border zd:border-white zd:bg-greyScale/10',
            badgeSide === 'left' ? 'zd:left-1' : 'zd:right-1',
          )}
        >
          <img
            src={chainIconUrl}
            alt=""
            className="zd:size-full zd:object-contain"
          />
        </div>
      )}
    </div>
  )
}

function AddressLine({ address, href }: { address: string; href?: string }) {
  const inner = (
    <>
      <span className="zd:truncate">{address}</span>
      {href && (
        <Icon
          name="export"
          className="zd:size-3 zd:shrink-0 zd:text-solarOrange"
          aria-hidden
        />
      )}
    </>
  )

  const className =
    'zd:flex zd:min-w-0 zd:items-center zd:gap-1 zd:text-body3 zd:text-greyScale/50'

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className={cn(className, 'zd:hover:text-greyScale')}
      >
        {inner}
      </a>
    )
  }
  return <span className={className}>{inner}</span>
}
