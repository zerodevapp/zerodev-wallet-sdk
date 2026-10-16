import { cn, Icon, type IconName, Text } from '@zerodev/react-ui'
import { useState } from 'react'
import type { TxHistoryStatus } from '../../types'

export const TX_HISTORY_STATUS_COLOR: Record<TxHistoryStatus, string> = {
  Pending: 'zd:text-solarOrange',
  Success: 'zd:text-positive',
  Failed: 'zd:text-negative',
  Unknown: 'zd:text-greyScale/50',
}

export interface TxHistoryItemProps {
  /** The operation glyph: the tile when there is no image, a badge on it otherwise. */
  icon: IconName
  /** The asset image for the tile. Falls back to the glyph if it fails to load. */
  imageUri?: string
  /** Truncates when long; the value keeps its space. */
  title: string
  /** Truncates past roughly half the row. */
  value?: string
  /** The unit `value` ends with; it stays visible while the amount truncates. */
  unit?: string
  /** An incoming amount is tinted; an outgoing one is not. */
  flow?: 'in' | 'out'
  chain: { name: string; iconUri?: string | undefined }
  status: TxHistoryStatus
  className?: string
}

export function TxHistoryItem({
  icon,
  imageUri,
  title,
  value,
  unit,
  flow,
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
      <Tile icon={icon} imageUri={imageUri} />

      <div className="zd:flex zd:min-w-0 zd:flex-1 zd:flex-col zd:gap-2">
        <div className="zd:flex zd:w-full zd:items-center zd:justify-between zd:gap-2">
          <Text className="zd:min-w-0 zd:truncate zd:text-body1">{title}</Text>
          {value && (
            <Text
              className={cn(
                'zd:flex zd:max-w-[55%] zd:shrink-0 zd:justify-end zd:text-right zd:text-body1',
                flow === 'in' && 'zd:text-positive',
              )}
            >
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

/** The asset image with the operation as a badge, or the operation alone. */
function Tile({
  icon,
  imageUri,
}: {
  icon: IconName
  imageUri: string | undefined
}) {
  const [failed, setFailed] = useState(false)
  const image = imageUri && !failed ? imageUri : undefined
  return (
    <div className="zd:relative zd:flex zd:size-11 zd:shrink-0 zd:items-center zd:justify-center zd:rounded-xl zd:bg-white">
      {image ? (
        <>
          <img
            src={image}
            alt=""
            aria-hidden
            onError={() => setFailed(true)}
            className="zd:size-8 zd:rounded-full zd:object-cover"
          />
          <span className="zd:absolute zd:-right-1 zd:-bottom-1 zd:flex zd:size-5 zd:items-center zd:justify-center zd:rounded-full zd:bg-white zd:shadow-sm">
            <Icon name={icon} className="zd:size-3" />
          </span>
        </>
      ) : (
        <Icon name={icon} className="zd:size-5" />
      )}
    </div>
  )
}

/**
 * An amount gives way before its unit: the amount shrinks a thousand times
 * faster, so a long amount truncates first. A unit is capped at a fixed
 * width that every ordinary symbol fits in, so a long symbol truncates
 * and leaves the amount legible. (A share of the column would not work:
 * the column shrink-wraps its content, so the share would be circular.)
 * Anything without a unit truncates as a whole.
 */
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
      <span className="zd:min-w-0 zd:shrink-[1000] zd:truncate">
        {value.slice(0, -suffix.length)}
      </span>
      <span className="zd:min-w-0 zd:max-w-20 zd:truncate zd:whitespace-pre">
        {suffix}
      </span>
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
