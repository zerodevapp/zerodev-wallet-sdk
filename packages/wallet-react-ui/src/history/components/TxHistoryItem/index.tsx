import { cn, Icon, type IconName, Text } from '@zerodev/react-ui'
import type { TxHistoryStatus } from '../../types'

export const TX_HISTORY_STATUS_COLOR: Record<TxHistoryStatus, string> = {
  Pending: 'zd:text-solarOrange',
  Success: 'zd:text-positive',
  Failed: 'zd:text-negative',
  Unknown: 'zd:text-greyScale/50',
}

export interface TxHistoryItemProps {
  icon: IconName
  /** Truncates when long; the value keeps its space. */
  title: string
  /** Truncates past roughly half the row. */
  value?: string
  /** The unit `value` ends with; it stays visible while the amount truncates. */
  unit?: string
  chain: { name: string; iconUri?: string | undefined }
  status: TxHistoryStatus
  className?: string
}

export function TxHistoryItem({
  icon,
  title,
  value,
  unit,
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
          <Text className="zd:min-w-0 zd:truncate zd:text-body1">{title}</Text>
          {value && (
            <Text className="zd:flex zd:max-w-[55%] zd:shrink-0 zd:justify-end zd:text-right zd:text-body1">
              <RowValue value={value} unit={unit} />
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
            className={cn(
              'zd:shrink-0 zd:text-body3',
              TX_HISTORY_STATUS_COLOR[status],
            )}
          >
            {status}
          </Text>
        </div>
      </div>
    </div>
  )
}

/** An amount gives way before its unit; anything else truncates as a whole. */
function RowValue({
  value,
  unit,
}: {
  value: string
  unit: string | undefined
}) {
  const suffix = unit && ` ${unit}`
  if (!suffix || !value.endsWith(suffix)) {
    return <span className="zd:min-w-0 zd:truncate">{value}</span>
  }
  return (
    <>
      <span className="zd:min-w-0 zd:truncate">
        {value.slice(0, -suffix.length)}
      </span>
      <span className="zd:shrink-0 zd:whitespace-pre">{suffix}</span>
    </>
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
