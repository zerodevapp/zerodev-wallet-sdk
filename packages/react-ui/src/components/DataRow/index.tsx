import type { ReactNode } from 'react'

import { cn } from '../../utils/common'
import { Icon } from '../Icon'
import { Text } from '../Text'

export interface DataRowProps {
  /** Label rendered on the left (e.g., "Max slippage"). */
  label: string
  /** Value rendered on the right. Accepts a string (wrapped in `Text`) or an
   * arbitrary ReactNode (rendered verbatim). */
  value: ReactNode
  /** Renders a small info icon (14×14, greyScale/50) between the label and
   * the value. */
  info?: boolean
  /** Handler for the info icon; when supplied, the icon becomes a keyboard-
   * accessible button. Requires `info` to be true. */
  onInfoClick?: () => void
  /** Tooltip text shown on hover over the info icon. Consumers that ship
   * the widget's `styles.css` get a styled floating tooltip; otherwise the
   * native browser tooltip is used. Ignored when `info` is false. */
  infoTooltip?: string
  /** Content rendered inside the value group, before the value. Typically a
   * small decorative or status icon (e.g. warning). */
  leading?: ReactNode
  /** Content rendered inside the value group, after the value. Typically a
   * chevron or trailing icon. */
  trailing?: ReactNode
  /** `'default'` for a plain inline row; `'warning'` for the orange-tinted
   * card treatment (Figma "Minimum deposit"). */
  variant?: 'default' | 'warning'
  className?: string
}

export function DataRow({
  label,
  value,
  info,
  onInfoClick,
  infoTooltip,
  leading,
  trailing,
  variant = 'default',
  className,
}: DataRowProps) {
  const isWarning = variant === 'warning'
  const textColorClass = isWarning ? 'zd:text-solarOrange' : undefined

  return (
    <div
      className={cn(
        'zd:relative zd:flex zd:w-full zd:items-center',
        isWarning
          ? // Warning: card treatment — 14px radius, border, backdrop blur,
            // 10% orange tint, universal inner shadow, tighter row padding.
            [
              'zd:gap-2 zd:overflow-hidden zd:rounded-[14px] zd:border-[0.3px] zd:border-offWhite zd:px-4 zd:py-2 zd:backdrop-blur-[15px]',
              'zd:shadow-[inset_0_-4px_4px_0_rgba(255,255,255,0.1),inset_0_3px_4px_0_rgba(0,0,0,0.02)]',
            ]
          : // Default: plain inline row with a 4px gap between children and
            // 4px vertical padding.
            'zd:gap-1 zd:py-1',
        className,
      )}
      style={
        isWarning ? { backgroundColor: 'rgba(242, 123, 62, 0.1)' } : undefined
      }
    >
      <Text className={cn('zd:whitespace-nowrap', textColorClass)}>
        {label}
      </Text>
      {info &&
        (onInfoClick ? (
          <button
            type="button"
            onClick={onInfoClick}
            aria-label={`${label} — more info`}
            className="zd:flex zd:items-center zd:justify-center zd:cursor-pointer"
            data-testid="data-row-info"
            {...(infoTooltip && { title: infoTooltip, 'data-zd-tooltip': '' })}
          >
            <Icon
              name="info"
              className={cn(
                'zd:w-3.5 zd:h-3.5',
                isWarning ? 'zd:text-solarOrange' : 'zd:text-greyScale/50',
              )}
              aria-hidden
            />
          </button>
        ) : infoTooltip ? (
          // Wrap in a span so the `title` attribute and `data-zd-tooltip`
          // marker sit on a hoverable box (browsers ignore `title` on SVG).
          <span
            className="zd:inline-flex zd:items-center zd:justify-center zd:cursor-help"
            data-testid="data-row-info"
            data-zd-tooltip=""
            title={infoTooltip}
          >
            <Icon
              name="info"
              className={cn(
                'zd:w-3.5 zd:h-3.5',
                isWarning ? 'zd:text-solarOrange' : 'zd:text-greyScale/50',
              )}
              aria-hidden
            />
          </span>
        ) : (
          <Icon
            name="info"
            className={cn(
              'zd:w-3.5 zd:h-3.5',
              isWarning ? 'zd:text-solarOrange' : 'zd:text-greyScale/50',
            )}
            data-testid="data-row-info"
            aria-hidden
          />
        ))}
      {/* Spacer pushes the value to the right end. min-w-0 so the label and
          value can shrink independently if the container is narrow. */}
      <div className="zd:min-w-0 zd:flex-1" />
      <div
        className="zd:flex zd:items-center zd:gap-[5px]"
        data-testid="data-row-value"
      >
        {leading}
        {typeof value === 'string' ? (
          <Text className={cn('zd:whitespace-nowrap', textColorClass)}>
            {value}
          </Text>
        ) : (
          value
        )}
        {trailing}
      </div>
    </div>
  )
}

export interface DataRowSkeletonProps {
  /** Optional label to render as-is on the left; when omitted a pulse
   * placeholder is drawn in its place. */
  label?: string
  className?: string
}

export function DataRowSkeleton({ label, className }: DataRowSkeletonProps) {
  return (
    <div
      className={cn(
        'zd:flex zd:flex-row zd:items-center zd:justify-between zd:py-1',
        className,
      )}
    >
      {label ? (
        <Text>{label}</Text>
      ) : (
        <div className="zd:w-24 zd:h-3 zd:rounded-lg zd:bg-offWhite/50 zd:animate-pulse" />
      )}
      <div className="zd:w-24 zd:h-3 zd:rounded-lg zd:bg-offWhite/50 zd:animate-pulse" />
    </div>
  )
}
