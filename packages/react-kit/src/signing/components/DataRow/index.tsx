import type { ReactNode } from 'react'

import { Icon, type IconName } from '../../../shared/components/Icon'
import { Text } from '../../../shared/components/Text'
import { camelCaseToTitle, cn } from '../../../shared/utils/common'

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
      className={cn('flex flex-row items-center justify-between', className)}
    >
      <Text>{camelCaseToTitle(label)}</Text>
      <div className="flex flex-row items-center gap-1">
        {leadingIconName && (
          <Icon name={leadingIconName} className="h-3 w-3 text-solarOrange" />
        )}
        {typeof value === 'string' ? (
          <Text className="text-body1">{value}</Text>
        ) : (
          value
        )}
        {iconName && (
          <Icon name={iconName} className="w-4 h-4 text-solarOrange" />
        )}
      </div>
    </div>
  )
}

interface DataRowSkeletonProps {
  className?: string
}

export function DataRowSkeleton({ className }: DataRowSkeletonProps) {
  return (
    <div
      className={cn('flex flex-row items-center justify-between', className)}
    >
      <div className="w-20 h-3 rounded-lg bg-offWhite/50 animate-pulse" />
      <div className="w-24 h-3 rounded-lg bg-offWhite/50 animate-pulse" />
    </div>
  )
}
