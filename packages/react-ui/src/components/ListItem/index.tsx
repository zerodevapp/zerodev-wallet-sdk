import { Slot } from 'radix-ui'
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react'

import { cn } from '../../utils/common'
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

interface ListItemBaseProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  title: string
  /** Secondary line under the title — plain text (auto-styled) or any node,
   * e.g. a `<Badge />`. */
  subtitle?: ReactNode
  /** Leading tile content — any node (`ListItemIcon`, `<img>`, a brand mark).
   * Size the node itself (e.g. `zd:w-6 zd:h-6`); the tile keeps its frame. */
  icon?: ReactNode
  /** Right side of the row — `<ListItemChevron />` or any custom node. */
  trailing?: ReactNode
}

// `children` is only meaningful as the asChild target — the union makes the
// pairing a compile-time contract.
type ListItemAsChildProps =
  | {
      /** Render the row into the child element (e.g. an `<a>`) instead of a
       * `<button>`. Pass a single childless element; the row layout is
       * injected into it. */
      asChild: true
      children: ReactElement
    }
  | { asChild?: false; children?: never }

export type ListItemProps = ListItemBaseProps & ListItemAsChildProps

export function ListItem({
  icon,
  title,
  subtitle,
  trailing,
  asChild,
  children,
  className,
  ...rest
}: ListItemProps) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Wrapper className={cn('zd:w-full zd:h-17 zd:rounded-2xl', className)}>
      <Comp
        {...(!asChild && { type: 'button' as const })}
        className={cn(
          'zd:w-full zd:flex zd:flex-row zd:justify-between zd:items-center zd:p-2 zd:transition-colors zd:cursor-pointer zd:hover:bg-white/20 zd:active:bg-white/30',
          rest.disabled && 'zd:opacity-50 zd:cursor-not-allowed',
        )}
        {...rest}
      >
        {asChild && <Slot.Slottable>{children}</Slot.Slottable>}
        <div className="zd:flex zd:flex-row zd:items-center zd:gap-3">
          <div className="zd:w-13 zd:h-13 zd:rounded-2xl zd:bg-white zd:flex zd:items-center zd:justify-center zd:shrink-0">
            {icon}
          </div>
          <div className="zd:flex zd:flex-col zd:justify-center zd:text-left zd:gap-1">
            <Text className="zd:text-body1">{title}</Text>
            {typeof subtitle === 'string' ? (
              <Text className="zd:text-body3 zd:text-greyScale/50">
                {subtitle}
              </Text>
            ) : (
              subtitle
            )}
          </div>
        </div>
        {trailing}
      </Comp>
    </Wrapper>
  )
}

export interface ListItemIconProps {
  name: IconName
  className?: string
}

/** Standard leading icon for the tile — pre-sized and colored for the slot;
 * override via `className` (e.g. `zd:text-solarOrange`). */
export function ListItemIcon({ name, className }: ListItemIconProps) {
  return (
    <Icon
      name={name}
      className={cn('zd:w-6 zd:h-6 zd:text-greyScale', className)}
    />
  )
}

/** Standard trailing chevron for navigation rows. */
export function ListItemChevron() {
  return (
    <div className="zd:w-13 zd:h-13 zd:flex zd:items-center zd:justify-center">
      <Icon name="chevronRight" className="zd:h-6 zd:w-6 zd:text-greyScale" />
    </div>
  )
}
