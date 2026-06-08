import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../utils/common'
import { Icon, type IconName } from '../Icon'
import { Text } from '../Text'
import { Wrapper } from '../Wrapper'

export interface SelectProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Primary label (e.g. token symbol). */
  label: string
  /** Optional subtitle row (e.g. chain name). */
  subtitle?: string
  /** Kit `Icon` name for the leading slot (preferred for known chains/tokens). */
  iconName?: IconName
  /** URL of the leading image. Used when `iconName` is absent. */
  leadingImage?: string
  /** Optional small icon shown next to the subtitle (e.g. chain badge). */
  chainImage?: string
  /** Show the trailing chevron-down. Defaults to `true`. */
  trailingIcon?: boolean
  /** Render a skeleton placeholder instead of the content. */
  loading?: boolean
}

export function SelectSkeleton({
  className,
}: {
  className?: string | undefined
}) {
  return (
    <Wrapper className={cn('h-16 rounded-xl p-1.5 opacity-60', className)}>
      <div className="size-13 rounded-xl border-offWhite border-[0.3px] bg-offWhite/40 animate-pulse" />
    </Wrapper>
  )
}

export function Select({
  label,
  subtitle,
  iconName,
  leadingImage,
  chainImage,
  trailingIcon = true,
  loading = false,
  className,
  ...rest
}: SelectProps) {
  if (loading) return <SelectSkeleton className={className} />

  const hasLeading = !!iconName || !!leadingImage
  const hasLeadingBlock = hasLeading || !!subtitle

  return (
    <Wrapper className={cn('h-13 rounded-2xl', className)}>
      <button
        type="button"
        className={cn(
          'w-full h-full flex flex-row items-center justify-between gap-2 transition-colors',
          hasLeading ? 'pl-1' : 'pl-4',
          'pr-2 py-1',
          rest.disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer hover:bg-offWhite/40',
        )}
        {...rest}
      >
        <div className="flex flex-row items-center gap-1.5 min-w-0">
          {hasLeading && (
            <div className="size-11 shrink-0 rounded-xl bg-white overflow-hidden flex items-center justify-center">
              {iconName ? (
                <Icon name={iconName} className="size-6" />
              ) : leadingImage ? (
                <img
                  src={leadingImage}
                  alt=""
                  className="size-full object-cover"
                />
              ) : null}
            </div>
          )}
          {hasLeadingBlock ? (
            <div className="flex flex-col items-start gap-1.5 min-w-0">
              <Text className="text-body1 truncate">{label}</Text>
              {subtitle && (
                <div className="flex flex-row items-center gap-1">
                  {chainImage && (
                    <span className="inline-block size-3 rounded-full overflow-hidden bg-white shrink-0">
                      <img
                        src={chainImage}
                        alt=""
                        className="size-full object-cover"
                      />
                    </span>
                  )}
                  <Text className="text-body3 text-greyScale/50 truncate">
                    {subtitle}
                  </Text>
                </div>
              )}
            </div>
          ) : (
            <Text className="text-body1 truncate">{label}</Text>
          )}
        </div>
        {trailingIcon && (
          <Icon
            name="chevronDown"
            className="size-4.5 text-greyScale shrink-0"
          />
        )}
      </button>
    </Wrapper>
  )
}
