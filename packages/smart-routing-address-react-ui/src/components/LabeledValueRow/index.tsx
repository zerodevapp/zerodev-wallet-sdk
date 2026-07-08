import { cn, Icon, Text } from '@zerodev/react-ui'
import type { ReactNode } from 'react'

export interface LabeledValueRowProps {
  /** Label rendered on the left (e.g., "Max slippage"). */
  label: string
  /** Value rendered on the right. Accepts a string or arbitrary ReactNode. */
  value: ReactNode
  /** Renders a 14×14 info icon at 50% opacity between the label and value. */
  info?: boolean
  /** Handler for the info icon; makes it a keyboard-accessible button. */
  onInfoClick?: () => void
  /**
   * Extra element rendered inline with the value (e.g., a chevron for
   * expandable rows — Figma 17634:104304).
   */
  trailing?: ReactNode
  /** `'default'` for plain rows; `'warning'` for the orange-tinted card. */
  variant?: 'default' | 'warning'
  className?: string
}

export function LabeledValueRow({
  label,
  value,
  info,
  onInfoClick,
  trailing,
  variant = 'default',
  className,
}: LabeledValueRowProps) {
  const isWarning = variant === 'warning'
  const textColorClass = isWarning ? 'zd:text-solarOrange' : undefined
  const infoColorClass = isWarning
    ? 'zd:text-solarOrange'
    : 'zd:text-greyScale/50'

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
            data-testid="labeled-value-row-info"
          >
            <Icon
              name="info"
              className={cn('zd:size-3.5', infoColorClass)}
              aria-hidden
            />
          </button>
        ) : (
          <Icon
            name="info"
            className={cn('zd:size-3.5', infoColorClass)}
            data-testid="labeled-value-row-info"
            aria-hidden
          />
        ))}
      {/* Spacer pushes the value to the right end. min-w-0 so the label
          and value can shrink independently if the container is narrow. */}
      <div className="zd:min-w-0 zd:flex-1" />
      <div
        className="zd:flex zd:items-center zd:gap-[5px]"
        data-testid="labeled-value-row-value"
      >
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
