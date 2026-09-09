import { cn, Icon, Text } from '@zerodev/react-ui'

export type TxnStatus = 'Routing' | 'Detected' | 'Delivered' | 'Failed'

export interface TxnItemProps {
  /** Pre-formatted deposited amount, e.g. `"$248.00 USD"`. */
  amount: string
  /**
   * Pre-formatted delivered amount. Presence switches the row to the
   * detailed (past-deposits) layout — `amount → destAmount` headline plus
   * the chain-route line (Figma `20002:37771`); without it the row is the
   * compact active-deposits variant (`20002:36061`).
   */
  destAmount?: string
  /** Short address/hash display, e.g. `"0x4d2a…ba99"`. */
  address: string
  /** Optional block-explorer URL. Address row becomes a link when supplied. */
  href?: string
  /** Pre-formatted relative timestamp, e.g. `"2 m ago"`. */
  timestamp: string
  status: TxnStatus
  /** Main image in the 44px mark. */
  sourceTokenIconUrl?: string
  /** Mark badge on the compact variant; chain-route icon on the detailed. */
  sourceChainIconUrl?: string
  /** Mark badge on the detailed variant. */
  destTokenIconUrl?: string
  /** Chain-route icon on the detailed variant. */
  destChainIconUrl?: string
  /** Chain-route labels — detailed variant only. */
  sourceChainName?: string
  destChainName?: string
  className?: string
}

const STATUS_COLOR: Record<TxnStatus, string> = {
  Routing: 'zd:text-solarOrange',
  Detected: 'zd:text-greyScale/50',
  Delivered: 'zd:text-positive',
  Failed: 'zd:text-negative',
}

export function TxnItem({
  amount,
  destAmount,
  address,
  href,
  timestamp,
  status,
  sourceTokenIconUrl,
  sourceChainIconUrl,
  destTokenIconUrl,
  destChainIconUrl,
  sourceChainName,
  destChainName,
  className,
}: TxnItemProps) {
  const detailed = destAmount !== undefined
  // Compact rows badge the mark with the chain; detailed rows badge it with
  // the destination token (the route line already names both chains).
  const badgeIconUrl = detailed ? destTokenIconUrl : sourceChainIconUrl

  return (
    <div
      className={cn(
        'zd:relative zd:flex zd:w-full zd:items-start zd:gap-2 zd:rounded-2xl zd:p-2',
        className,
      )}
    >
      <TokenMark
        {...(sourceTokenIconUrl && { tokenIconUrl: sourceTokenIconUrl })}
        {...(badgeIconUrl && { badgeIconUrl })}
      />

      {/* gap-1, not the Figma node's 8px: the design measures between
          leading-trimmed text boxes (text-box-trim), while our Text renders
          130% line-height — ~2px of leading above and below each line — so
          4px + leading visually lands on the design's 8px. */}
      <div className="zd:flex zd:min-w-0 zd:flex-1 zd:flex-col zd:gap-1 zd:py-2">
        <div className="zd:flex zd:min-w-0 zd:items-center zd:gap-1">
          <Text className="zd:truncate zd:text-body2">{amount}</Text>
          {detailed && (
            <>
              <RouteArrow />
              <Text className="zd:truncate zd:text-body2">{destAmount}</Text>
            </>
          )}
        </div>

        {detailed && (sourceChainName || destChainName) && (
          <div className="zd:flex zd:min-w-0 zd:items-center zd:gap-1">
            {sourceChainName && (
              <ChainTag
                name={sourceChainName}
                {...(sourceChainIconUrl && { iconUrl: sourceChainIconUrl })}
              />
            )}
            {sourceChainName && destChainName && <RouteArrow />}
            {destChainName && (
              <ChainTag
                name={destChainName}
                {...(destChainIconUrl && { iconUrl: destChainIconUrl })}
              />
            )}
          </div>
        )}

        <AddressLine address={address} {...(href && { href })} />
      </div>

      <div className="zd:flex zd:shrink-0 zd:flex-col zd:items-end zd:justify-between zd:self-stretch zd:py-2">
        <span
          className={cn(
            'zd:flex zd:items-center zd:gap-2',
            STATUS_COLOR[status],
          )}
        >
          {/* In-flight marker (Figma 20002:36058): rotating rays before the
              Routing label, inheriting its orange. */}
          {status === 'Routing' && (
            <Icon
              name="lineLoading"
              className="zd:size-2.5 zd:shrink-0 zd:animate-spin"
              aria-hidden
            />
          )}
          <Text className={cn('zd:text-body2', STATUS_COLOR[status])}>
            {status}
          </Text>
        </span>
        <Text className="zd:text-body3 zd:text-greyScale/50">{timestamp}</Text>
      </div>
    </div>
  )
}

/** 44px mark (Figma "CryptoPresets"): centred 34px token image with a 12px
 * badge straddling the bottom-right corner. */
function TokenMark({
  tokenIconUrl,
  badgeIconUrl,
}: {
  tokenIconUrl?: string
  badgeIconUrl?: string
}) {
  return (
    <div className="zd:relative zd:size-11 zd:shrink-0 zd:rounded-xl zd:backdrop-blur-[15px]">
      <div className="zd:absolute zd:top-1/2 zd:left-1/2 zd:size-8.5 zd:-translate-x-1/2 zd:-translate-y-1/2 zd:overflow-hidden zd:rounded-full zd:border zd:border-offWhite zd:bg-greyScale/10 zd:shadow-[inset_0_-4px_4px_0_rgba(255,255,255,0.1),inset_0_3px_4px_0_rgba(0,0,0,0.02)]">
        {tokenIconUrl && (
          <img
            src={tokenIconUrl}
            alt=""
            className="zd:size-full zd:object-cover"
          />
        )}
      </div>
      {badgeIconUrl && (
        <div className="zd:absolute zd:right-1 zd:bottom-1 zd:size-3 zd:overflow-hidden zd:rounded-full zd:border zd:border-offWhite/40 zd:bg-white">
          <img
            src={badgeIconUrl}
            alt=""
            className="zd:size-full zd:object-contain"
          />
        </div>
      )}
    </div>
  )
}

/** 10px `›` separating the two sides of an amount / chain route. */
function RouteArrow() {
  return (
    <Icon
      name="chevronRight"
      className="zd:size-2.5 zd:shrink-0 zd:text-greyScale"
      aria-hidden
    />
  )
}

function ChainTag({ name, iconUrl }: { name: string; iconUrl?: string }) {
  return (
    <span className="zd:flex zd:min-w-0 zd:items-center zd:gap-1">
      {iconUrl && (
        <span className="zd:size-3 zd:shrink-0 zd:overflow-hidden zd:rounded-full zd:border zd:border-offWhite/40 zd:bg-white">
          <img
            src={iconUrl}
            alt=""
            aria-hidden
            className="zd:size-full zd:object-contain"
          />
        </span>
      )}
      <Text className="zd:truncate zd:text-body3 zd:text-greyScale/80">
        {name}
      </Text>
    </span>
  )
}

function AddressLine({ address, href }: { address: string; href?: string }) {
  const inner = (
    <>
      <span className="zd:truncate">{address}</span>
      {href && (
        // 8px, not the design's 10px box: our export glyph is full-bleed
        // while Figma's sits inset 10% in its box, so matching the box size
        // renders visibly bigger. 8px equals the design's effective glyph.
        <Icon name="export" className="zd:size-2 zd:shrink-0" aria-hidden />
      )}
    </>
  )

  const className =
    'zd:flex zd:min-w-0 zd:items-center zd:gap-1 zd:text-body3 zd:text-greyScale/80'

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={`View ${address} on block explorer`}
        className={cn(className, 'zd:hover:text-greyScale')}
      >
        {inner}
      </a>
    )
  }
  return <span className={className}>{inner}</span>
}
