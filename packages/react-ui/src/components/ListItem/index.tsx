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
        'zd:w-full zd:h-17 zd:rounded-2xl zd:border-offWhite zd:border-[0.3px]',
        className,
      )}
    >
      <div className="zd:flex zd:flex-row zd:justify-between zd:items-center zd:p-2">
        <div className="zd:flex zd:flex-row zd:items-center zd:gap-3">
          <div className="zd:w-13 zd:h-13 zd:rounded-2xl zd:bg-offWhite/50 zd:animate-pulse" />
          <div className="zd:gap-2">
            <div className="zd:w-14 zd:h-3 zd:rounded-lg zd:bg-offWhite/50 zd:animate-pulse zd:mb-2" />
            <div className="zd:w-14 zd:h-3 zd:rounded-lg zd:bg-offWhite/50 zd:animate-pulse" />
          </div>
        </div>
        <div className="zd:gap-2">
          <div className="zd:w-14 zd:h-3 zd:rounded-lg zd:bg-offWhite/50 zd:animate-pulse zd:mb-2" />
          <div className="zd:w-14 zd:h-3 zd:rounded-lg zd:bg-offWhite/50 zd:animate-pulse" />
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
        'zd:w-full zd:h-17 zd:rounded-2xl',
        alert && 'zd:border-0',
        className,
      )}
    >
      <button
        type="button"
        className={cn(
          'zd:w-full zd:flex zd:flex-row zd:justify-between zd:items-center zd:p-2 zd:transition-colors zd:cursor-pointer',
          alert
            ? 'zd:bg-solarOrange/15'
            : 'zd:hover:bg-white/20 zd:active:bg-white/30',
          rest.disabled && 'zd:opacity-50 zd:cursor-not-allowed',
        )}
        {...rest}
      >
        <div className="zd:flex zd:flex-row zd:items-center zd:gap-3">
          <div
            className={cn(
              'zd:w-13 zd:h-13 zd:rounded-2xl zd:flex zd:items-center zd:justify-center zd:shrink-0',
              alert ? 'zd:bg-offWhite/50' : 'zd:bg-white',
            )}
          >
            {imageUri ? (
              <img src={imageUri} alt="" className="zd:w-6 zd:h-6" />
            ) : iconName ? (
              <Icon
                name={iconName}
                className={cn(
                  'zd:w-6 zd:h-6',
                  details || alert
                    ? 'zd:text-solarOrange'
                    : 'zd:text-greyScale',
                )}
              />
            ) : null}
          </div>
          <div className="zd:flex zd:flex-col zd:justify-center zd:text-left zd:gap-1">
            <Text className="zd:text-body1">{title}</Text>
            {subtitle && (
              <Text className="zd:text-body3 zd:text-greyScale/50">
                {subtitle}
              </Text>
            )}
          </div>
        </div>
        <div className="zd:flex zd:flex-row zd:items-center">
          {badgeProps && (
            // Badge defaults to self-start (stretch guard for column layouts);
            // inside this row it must follow the row's vertical centering.
            <Badge
              {...badgeProps}
              className={cn('zd:self-center', badgeProps.className)}
            />
          )}
          {details ? (
            <div className="zd:flex zd:flex-col zd:pr-1">
              <Text className="zd:text-body1">{details.text}</Text>
              {details.subtext && (
                <Text className="zd:text-body3 zd:text-greyScale/50 zd:self-end">
                  {details.subtext}
                </Text>
              )}
            </div>
          ) : chevron ? (
            <div className="zd:w-13 zd:h-13 zd:flex zd:items-center zd:justify-center">
              <Icon
                name="chevronRight"
                className="zd:h-6 zd:w-6 zd:text-greyScale"
              />
            </div>
          ) : null}
        </div>
      </button>
    </Wrapper>
  )
}
