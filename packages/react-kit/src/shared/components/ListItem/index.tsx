import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../utils/common'
import { Badge, type BadgeProps } from '../Badge'
import { Icon, type IconName } from '../Icon'
import { Text } from '../Text'
import { Wrapper } from '../Wrapper'

interface ListItemSkeletonProps {
  className?: string
}

export function ListItemSkeleton({ className }: ListItemSkeletonProps) {
  return (
    <div
      className={cn(
        'w-full h-[68px] rounded-2xl border-white border-[0.3px]',
        className,
      )}
    >
      <div className="flex flex-row justify-between items-center p-2">
        <div className="flex flex-row items-center gap-3">
          <div className="w-[52px] h-[52px] rounded-2xl bg-offWhite/50 animate-pulse" />
          <div className="gap-2">
            <div className="w-14 h-3 rounded-lg bg-offWhite/50 animate-pulse mb-2" />
            <div className="w-14 h-3 rounded-lg bg-offWhite/50 animate-pulse" />
          </div>
        </div>
        <div className="gap-2">
          <div className="w-14 h-3 rounded-lg bg-offWhite/50 animate-pulse mb-2" />
          <div className="w-14 h-3 rounded-lg bg-offWhite/50 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

export interface ListItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  iconName?: IconName
  imageUri?: string
  title: string
  subtitle?: string
  badgeProps?: BadgeProps
  details?: { text: string; subtext?: string }
  chevron?: boolean
  alert?: boolean
}

export function ListItem({
  iconName,
  imageUri,
  title,
  subtitle,
  badgeProps,
  details,
  chevron,
  alert,
  className,
  ...rest
}: ListItemProps) {
  return (
    <Wrapper
      className={cn(
        'w-full h-[68px] rounded-2xl',
        alert && 'border-0',
        className,
      )}
    >
      <button
        type="button"
        className={cn(
          'w-full flex flex-row justify-between items-center p-2 transition-colors',
          alert ? 'bg-solarOrange/15' : 'hover:bg-offWhite/50',
          rest.disabled && 'opacity-50 cursor-not-allowed',
        )}
        {...rest}
      >
        <div className="flex flex-row items-center gap-3">
          <div
            className={cn(
              'w-[52px] h-[52px] rounded-2xl flex items-center justify-center shrink-0',
              alert ? 'bg-offWhite/50' : 'bg-offWhite',
            )}
          >
            {imageUri ? (
              <img src={imageUri} alt="" className="w-6 h-6" />
            ) : iconName ? (
              <Icon
                name={iconName}
                className={cn(
                  'w-6 h-6',
                  details || alert ? 'text-solarOrange' : 'text-greyScale',
                )}
              />
            ) : null}
          </div>
          <div
            className={cn(
              'flex flex-col justify-center text-left',
              badgeProps ? 'gap-2' : 'gap-1',
            )}
          >
            <Text className="text-body1">{title}</Text>
            {subtitle && (
              <Text className="text-body3 text-greyScale/50">{subtitle}</Text>
            )}
            {badgeProps && <Badge {...badgeProps} />}
          </div>
        </div>
        {details ? (
          <div className="flex flex-col">
            <Text className="text-body1">{details.text}</Text>
            {details.subtext && (
              <Text className="text-body3 text-greyScale/50 self-end">
                {details.subtext}
              </Text>
            )}
          </div>
        ) : chevron ? (
          <Icon name="chevronRight" className="h-6 w-6" />
        ) : null}
      </button>
    </Wrapper>
  )
}
