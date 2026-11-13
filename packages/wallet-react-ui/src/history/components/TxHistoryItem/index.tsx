import { cn, Icon, type IconName, Text } from '@zerodev/react-ui'

export type TxHistoryStatus = 'Pending' | 'Success' | 'Failed'

const STATUS_COLOR: Record<TxHistoryStatus, string> = {
  Pending: 'zd:text-brand-primary',
  Success: 'zd:text-success-primary',
  Failed: 'zd:text-error-primary',
}

export interface TxHistoryItemProps {
  /** Leading glyph for the activity kind, e.g. `'arrowSwapHorizontalOutline'`
   * for swaps, `'lighting'` for staking/yield, `'imageFill'` for NFTs. */
  icon: IconName
  /** Activity label, e.g. `"Swapped ETH → USD₮0"`. Never truncated. */
  title: string
  /** Pre-formatted outcome, e.g. `"2,343 ETH"`. Truncates when long. */
  value: string
  /** Chain the transaction ran on (source chain for cross-chain rows). */
  chainName: string
  chainIconUrl?: string
  /** Destination chain. When present the row renders `chain → destChain`. */
  destChainName?: string
  destChainIconUrl?: string
  status: TxHistoryStatus
  className?: string
}

export function TxHistoryItem({
  icon,
  title,
  value,
  chainName,
  chainIconUrl,
  destChainName,
  destChainIconUrl,
  status,
  className,
}: TxHistoryItemProps) {
  return (
    <div
      className={cn(
        'zd:flex zd:w-full zd:items-center zd:gap-2 zd:p-2',
        className,
      )}
    >
      <div className="zd:flex zd:size-11 zd:shrink-0 zd:items-center zd:justify-center zd:rounded-xl zd:bg-bright-primary">
        <Icon name={icon} className="zd:size-5" />
      </div>

      <div className="zd:flex zd:min-w-0 zd:flex-1 zd:flex-col zd:gap-2">
        <div className="zd:flex zd:w-full zd:items-center zd:justify-between zd:gap-2">
          <Text className="zd:shrink-0 zd:whitespace-nowrap zd:text-body1">
            {title}
          </Text>
          <Text className="zd:min-w-0 zd:truncate zd:text-right zd:text-body1">
            {value}
          </Text>
        </div>

        <div className="zd:flex zd:w-full zd:items-center zd:justify-between zd:gap-2">
          <div className="zd:flex zd:min-w-0 zd:items-center zd:gap-2">
            <ChainTag
              name={chainName}
              {...(chainIconUrl && { iconUrl: chainIconUrl })}
            />
            {destChainName && (
              <>
                <Icon
                  name="arrowRightFill"
                  aria-hidden
                  className="zd:size-3 zd:shrink-0 zd:opacity-30"
                />
                <ChainTag
                  name={destChainName}
                  {...(destChainIconUrl && { iconUrl: destChainIconUrl })}
                />
              </>
            )}
          </div>
          <Text
            className={cn('zd:shrink-0 zd:text-body3', STATUS_COLOR[status])}
          >
            {status}
          </Text>
        </div>
      </div>
    </div>
  )
}

function ChainTag({ name, iconUrl }: { name: string; iconUrl?: string }) {
  return (
    <div className="zd:flex zd:min-w-0 zd:items-center zd:gap-[5px]">
      {iconUrl && (
        <span className="zd:size-3 zd:shrink-0 zd:overflow-hidden zd:rounded-full zd:bg-bright-primary">
          <img
            src={iconUrl}
            alt=""
            aria-hidden
            className="zd:size-full zd:object-cover"
          />
        </span>
      )}
      <Text className="zd:truncate zd:text-body3">{name}</Text>
    </div>
  )
}
