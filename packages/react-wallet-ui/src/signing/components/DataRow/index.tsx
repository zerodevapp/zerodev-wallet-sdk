import { cn, Icon, type IconName, Text } from '@zerodev/react-ui'
import type { ReactNode } from 'react'
import { camelCaseToTitle } from '../../../shared/utils/common'

export interface DataRowProps {
  label?: string
  value: string | ReactNode
  iconName?: IconName
  leadingIconName?: IconName
  className?: string
}

export function DataRow({
  label,
  value,
  iconName,
  leadingIconName,
  className,
}: DataRowProps) {
  if (!label) return null

  return (
    <div
      className={cn(
        'zd:flex zd:flex-row zd:items-center zd:justify-between',
        className,
      )}
    >
      <Text>{camelCaseToTitle(label)}</Text>
      <div className="zd:flex zd:flex-row zd:items-center zd:gap-1">
        {leadingIconName && (
          <Icon
            name={leadingIconName}
            className="zd:h-3 zd:w-3 zd:text-solarOrange"
          />
        )}
        {typeof value === 'string' ? (
          <Text className="zd:text-body1">{value}</Text>
        ) : (
          value
        )}
        {iconName && (
          <Icon name={iconName} className="zd:w-4 zd:h-4 zd:text-solarOrange" />
        )}
      </div>
    </div>
  )
}

interface DataRowSkeletonProps {
  className?: string
  label?: string
}

export function DataRowSkeleton({ className, label }: DataRowSkeletonProps) {
  return (
    <div
      className={cn(
        'zd:flex zd:flex-row zd:items-center zd:justify-between',
        className,
      )}
    >
      {label ? (
        <Text>{camelCaseToTitle(label)}</Text>
      ) : (
        <div className="zd:w-24 zd:h-3 zd:rounded-lg zd:bg-offWhite/50 zd:animate-pulse" />
      )}
      <div className="zd:w-24 zd:h-3 zd:rounded-lg zd:bg-offWhite/50 zd:animate-pulse" />
    </div>
  )
}
