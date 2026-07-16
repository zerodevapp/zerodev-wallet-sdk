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
        'zd:shrink-0 zd:bg-white zd:flex zd:items-center zd:justify-center zd:overflow-hidden',
        isNetwork
          ? 'zd:w-9 zd:h-9 zd:rounded-full'
          : 'zd:w-11 zd:h-11 zd:rounded-2xl',
      )}
    >
      {iconName ? (
        <Icon name={iconName} className="zd:w-6 zd:h-6" />
      ) : imageSource ? (
        <img
          src={imageSource}
          alt=""
          className="zd:w-6 zd:h-6 zd:object-contain"
        />
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
        'zd:w-full zd:p-2 zd:flex zd:flex-row zd:items-center zd:justify-between zd:gap-2',
        className,
      )}
    >
      <div className="zd:flex zd:flex-row zd:items-center zd:gap-2 zd:min-w-0">
        <div className="zd:w-11 zd:h-11 zd:shrink-0 zd:rounded-2xl zd:bg-offWhite/40 zd:animate-pulse" />
        <div className="zd:flex zd:flex-col zd:gap-2">
          <div className="zd:h-3 zd:w-14 zd:rounded-md zd:bg-offWhite/40 zd:animate-pulse" />
          <div className="zd:h-3 zd:w-10 zd:rounded-md zd:bg-offWhite/40 zd:animate-pulse" />
        </div>
      </div>
      <div className="zd:flex zd:flex-col zd:items-end zd:gap-2 zd:shrink-0">
        <div className="zd:h-3 zd:w-12 zd:rounded-md zd:bg-offWhite/40 zd:animate-pulse" />
        <div className="zd:h-3 zd:w-10 zd:rounded-md zd:bg-offWhite/40 zd:animate-pulse" />
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
    ? 'zd:text-negative'
    : 'zd:text-positive'

  const content = (
    <>
      <div className="zd:flex zd:flex-row zd:items-center zd:gap-2 zd:min-w-0">
        <IconBlock
          {...(iconName && { iconName })}
          {...(imageSource && { imageSource })}
          variant={iconVariant}
        />
        <div className="zd:flex zd:flex-col zd:items-start zd:gap-2 zd:min-w-0">
          <Text className="zd:text-body1 zd:truncate">{symbol}</Text>
          {subtitle && (
            <div className="zd:flex zd:flex-row zd:items-center zd:gap-1 zd:min-w-0">
              {subtitleIcon && (
                <span className="zd:inline-flex zd:w-3 zd:h-3 zd:rounded-full zd:bg-offWhite/50 zd:overflow-hidden zd:shrink-0 zd:items-center zd:justify-center">
                  <Icon name={subtitleIcon} className="zd:w-full zd:h-full" />
                </span>
              )}
              <Text className="zd:text-body3 zd:text-greyScale/50 zd:truncate">
                {subtitle}
              </Text>
            </div>
          )}
        </div>
      </div>
      {(value || change) && (
        <div className="zd:flex zd:flex-col zd:items-end zd:gap-2 zd:shrink-0">
          {value && <Text className="zd:text-body1 zd:truncate">{value}</Text>}
          {change && (
            <Text className={cn('zd:text-body3 zd:truncate', changeColor)}>
              {change}
            </Text>
          )}
        </div>
      )}
    </>
  )

  const baseClassName = cn(
    'zd:w-full zd:p-2 zd:flex zd:flex-row zd:items-center zd:justify-between zd:gap-2 zd:text-left',
    className,
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          baseClassName,
          'zd:transition-colors zd:rounded-xl',
          (rest as ButtonHTMLAttributes<HTMLButtonElement>).disabled
            ? 'zd:opacity-50 zd:cursor-not-allowed'
            : 'zd:cursor-pointer zd:hover:bg-offWhite/40',
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
