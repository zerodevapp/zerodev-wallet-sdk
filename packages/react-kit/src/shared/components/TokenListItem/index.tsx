import type { ButtonHTMLAttributes, HTMLAttributes } from 'react'

import { cn } from '../../utils/common'
import { Icon, type IconName } from '../Icon'
import { Text } from '../Text'

export type TokenListItemIconVariant = 'token' | 'network'

interface CommonProps {
  /** Primary text — usually a token symbol like "ETH". */
  symbol: string
  /** Subtitle text under the symbol (e.g. "3 networks" or "Arbitrum"). */
  subtitle?: string
  /** Kit `Icon` name for the main slot (preferred for known chains/tokens). */
  iconName?: IconName
  /** URL of the main icon image (token logo). Used when `iconName` is absent. */
  imageSource?: string
  /** Kit `Icon` name rendered inline before the subtitle text (e.g. chain logo). */
  subtitleIcon?: IconName
  /** Right-aligned value (e.g. "$0.00"). */
  value?: string
  /** Right-aligned percentage change. Coloured green by default, red when
   * the string starts with a leading "-". */
  change?: string
  /** Shape of the main icon. `'token'` = 44x44 rounded square (default),
   * `'network'` = 36x36 circle. */
  iconVariant?: TokenListItemIconVariant
  /** Render a skeleton placeholder instead of the content. */
  loading?: boolean
}

export type TokenListItemProps = CommonProps &
  (
    | ({ onClick: ButtonHTMLAttributes<HTMLButtonElement>['onClick'] } & Omit<
        ButtonHTMLAttributes<HTMLButtonElement>,
        keyof CommonProps | 'children'
      >)
    | ({ onClick?: undefined } & Omit<
        HTMLAttributes<HTMLDivElement>,
        keyof CommonProps | 'children'
      >)
  )

function IconBlock({
  iconName,
  imageSource,
  variant,
}: {
  iconName?: IconName
  imageSource?: string
  variant: TokenListItemIconVariant
}) {
  const isNetwork = variant === 'network'
  return (
    <div
      className={cn(
        'shrink-0 bg-white flex items-center justify-center overflow-hidden',
        isNetwork ? 'size-9 rounded-full' : 'size-11 rounded-2xl',
      )}
    >
      {iconName ? (
        <Icon name={iconName} className="size-6" />
      ) : imageSource ? (
        <img src={imageSource} alt="" className="size-6 object-contain" />
      ) : null}
    </div>
  )
}

function TokenListItemSkeleton({
  className,
}: {
  className?: string | undefined
}) {
  return (
    <div
      className={cn(
        'w-full p-2 flex flex-row items-center justify-between gap-2',
        className,
      )}
    >
      <div className="flex flex-row items-center gap-2 min-w-0">
        <div className="size-11 shrink-0 rounded-2xl bg-offWhite/40 animate-pulse" />
        <div className="flex flex-col gap-2">
          <div className="h-3 w-14 rounded-md bg-offWhite/40 animate-pulse" />
          <div className="h-3 w-10 rounded-md bg-offWhite/40 animate-pulse" />
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <div className="h-3 w-12 rounded-md bg-offWhite/40 animate-pulse" />
        <div className="h-3 w-10 rounded-md bg-offWhite/40 animate-pulse" />
      </div>
    </div>
  )
}

export function TokenListItem({
  symbol,
  subtitle,
  iconName,
  imageSource,
  subtitleIcon,
  value,
  change,
  iconVariant = 'token',
  loading = false,
  className,
  onClick,
  ...rest
}: TokenListItemProps) {
  if (loading) return <TokenListItemSkeleton className={className} />

  const changeColor = change?.startsWith('-')
    ? 'text-negative'
    : 'text-positive'

  const content = (
    <>
      <div className="flex flex-row items-center gap-2 min-w-0">
        <IconBlock
          {...(iconName && { iconName })}
          {...(imageSource && { imageSource })}
          variant={iconVariant}
        />
        <div className="flex flex-col items-start gap-2 min-w-0">
          <Text className="text-body1 truncate">{symbol}</Text>
          {subtitle && (
            <div className="flex flex-row items-center gap-1 min-w-0">
              {subtitleIcon && (
                <span className="inline-flex size-3 rounded-full bg-offWhite/50 overflow-hidden shrink-0 items-center justify-center">
                  <Icon name={subtitleIcon} className="size-full" />
                </span>
              )}
              <Text className="text-body3 text-greyScale/50 truncate">
                {subtitle}
              </Text>
            </div>
          )}
        </div>
      </div>
      {(value || change) && (
        <div className="flex flex-col items-end gap-2 shrink-0">
          {value && <Text className="text-body1 truncate">{value}</Text>}
          {change && (
            <Text className={cn('text-body3 truncate', changeColor)}>
              {change}
            </Text>
          )}
        </div>
      )}
    </>
  )

  const baseClassName = cn(
    'w-full p-2 flex flex-row items-center justify-between gap-2 text-left',
    className,
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          baseClassName,
          'transition-colors rounded-xl',
          (rest as ButtonHTMLAttributes<HTMLButtonElement>).disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer hover:bg-offWhite/40',
        )}
        {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {content}
      </button>
    )
  }

  return (
    <div
      className={baseClassName}
      {...(rest as HTMLAttributes<HTMLDivElement>)}
    >
      {content}
    </div>
  )
}
