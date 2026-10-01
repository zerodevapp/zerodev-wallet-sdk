import { cn, Icon, type IconName, Text } from '@zerodev/react-ui'
import type { TxHistoryStatus } from '../../types'

const STATUS_COLOR: Record<TxHistoryStatus, string> = {
  Pending: 'zd:text-solarOrange',
  Success: 'zd:text-positive',
  Failed: 'zd:text-negative',
  Unknown: 'zd:text-greyScale/50',
}

export interface TxHistoryItemProps {
  icon: IconName
  /** Never truncated. */
  title: string
  /** Truncates when long. */
  value?: string
  chain: { name: string; iconUri?: string | undefined }
  status: TxHistoryStatus
  className?: string
}

export function TxHistoryItem({
  icon,
  title,
  value,
  chain,
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
      <div className="zd:flex zd:size-11 zd:shrink-0 zd:items-center zd:justify-center zd:rounded-xl zd:bg-white">
        <Icon name={icon} className="zd:size-5" />
      </div>

      <div className="zd:flex zd:min-w-0 zd:flex-1 zd:flex-col zd:gap-2">
        <div className="zd:flex zd:w-full zd:items-center zd:justify-between zd:gap-2">
          <Text className="zd:shrink-0 zd:whitespace-nowrap zd:text-body1">
            {title}
          </Text>
          {value && (
            <Text className="zd:min-w-0 zd:truncate zd:text-right zd:text-body1">
              {value}
            </Text>
          )}
        </div>

        <div className="zd:flex zd:w-full zd:items-center zd:justify-between zd:gap-2">
          <div className="zd:flex zd:min-w-0 zd:items-center zd:gap-[5px]">
            {chain.iconUri && (
              <span className="zd:size-3 zd:shrink-0 zd:overflow-hidden zd:rounded-full zd:bg-white">
                <img
                  src={chain.iconUri}
                  alt=""
                  aria-hidden
                  className="zd:size-full zd:object-cover"
                />
              </span>
            )}
            <Text className="zd:truncate zd:text-body3">{chain.name}</Text>
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

export function TxHistoryItemSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-testid="tx-history-item-skeleton"
      className={cn(
        'zd:flex zd:w-full zd:items-center zd:gap-2 zd:p-2',
        className,
      )}
    >
      <div className="zd:size-11 zd:shrink-0 zd:rounded-xl zd:bg-greyScale/15 zd:animate-skel-pulse" />
      <div className="zd:flex zd:min-w-0 zd:flex-1 zd:flex-col zd:gap-2">
        <div className="zd:flex zd:w-full zd:items-center zd:justify-between zd:gap-2">
          <div className="zd:h-3 zd:w-28 zd:rounded-lg zd:bg-greyScale/15 zd:animate-skel-pulse" />
          <div className="zd:h-3 zd:w-16 zd:rounded-lg zd:bg-greyScale/15 zd:animate-skel-pulse" />
        </div>
        <div className="zd:flex zd:w-full zd:items-center zd:justify-between zd:gap-2">
          <div className="zd:h-3 zd:w-20 zd:rounded-lg zd:bg-greyScale/15 zd:animate-skel-pulse" />
          <div className="zd:h-3 zd:w-12 zd:rounded-lg zd:bg-greyScale/15 zd:animate-skel-pulse" />
        </div>
      </div>
    </div>
  )
}
