import type { HTMLAttributes, KeyboardEvent, ReactNode, Ref } from 'react'
import { cn } from '../../utils/common'
import { Text } from '../Text'
import { Wrapper } from '../Wrapper'

export interface PillProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Text label rendered next to the logo (e.g., "USDC", "Base"). */
  label: string
  /** URL of the logo image; when omitted, a `logoBg` + first letter of `label` placeholder is drawn. */
  logoUri?: string
  /** Fallback background color when no `logoUri` is supplied. */
  logoBg?: string
  /** Click handler; when supplied and not `disabled`, the pill becomes a keyboard-accessible button. */
  onClick?: () => void
  /** When true, renders as a dimmed, non-interactive pill. */
  disabled?: boolean
  /** Optional trailing affordance (e.g., `<SelectIcon />`). Rendered in a padded slot on the right. */
  trailingIcon?: ReactNode
  ref?: Ref<HTMLDivElement>
}

export function Pill({
  label,
  logoUri,
  logoBg = '#E6EFFB',
  onClick,
  disabled,
  trailingIcon,
  className,
  ref,
  ...rest
}: PillProps) {
  const logoInitial = label.charAt(0).toUpperCase()

  const interactive = Boolean(onClick) && !disabled

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick?.()
    }
  }

  return (
    <Wrapper
      ref={ref}
      variant="solid"
      // Override Wrapper's variant-based bg color for the display variant —
      // Figma spec is exactly rgba(255,255,255,0.05), which none of the
      // Wrapper variants match. Inline style beats Wrapper's own style.
      style={
        disabled ? { backgroundColor: 'rgba(255, 255, 255, 0.05)' } : undefined
      }
      className={cn(
        // Sizing/padding matches Figma: outer pl-1 pr-2 py-1, rounded-2xl.
        // Height is content-driven — 44px logo + 4px vertical padding = 52px.
        'zd:relative zd:flex zd:w-full zd:items-center zd:justify-between zd:overflow-hidden zd:rounded-2xl zd:pl-1 zd:pr-2 zd:py-1',
        // Universal inner shadow from the Figma design token.
        'zd:shadow-[inset_0_-4px_4px_0_rgba(255,255,255,0.1),inset_0_3px_4px_0_rgba(0,0,0,0.02)]',
        !disabled && 'zd:cursor-pointer',
        className,
      )}
      {...rest}
      {...(interactive && {
        role: 'button',
        tabIndex: 0,
        onClick,
        onKeyDown: handleKeyDown,
      })}
    >
      <div className="zd:flex zd:items-center zd:gap-1.5">
        {/* 44×44 logo well with a 34×34 centered inner disc. Figma places the
            image with translate-1/2 offsets so the smaller disc sits inside
            the larger well — the 10px reveal reads as the pill's "logo pad". */}
        <div
          className="zd:relative zd:size-11 zd:shrink-0 zd:rounded-xl"
          aria-hidden={!logoUri}
        >
          <div
            className={cn(
              'zd:absolute zd:top-1/2 zd:left-1/2 zd:-translate-x-1/2 zd:-translate-y-1/2',
              'zd:flex zd:size-8.5 zd:items-center zd:justify-center',
              // Only round + clip when we're showing the letter fallback disc.
              // Real logo SVGs bring their own shape (round, diamond, etc.) —
              // clipping them to a circle chops off tips like Polygon's.
              !logoUri && 'zd:overflow-hidden zd:rounded-full',
            )}
            style={logoUri ? undefined : { backgroundColor: logoBg }}
          >
            {logoUri ? (
              <img
                alt=""
                src={logoUri}
                className="zd:size-full zd:object-contain"
                data-testid="token-chain-pill-logo"
              />
            ) : logoInitial ? (
              <span className="zd:text-body2 zd:font-medium zd:text-white">
                {logoInitial}
              </span>
            ) : null}
          </div>
        </div>
        <Text className="zd:whitespace-nowrap zd:text-body1">{label}</Text>
      </div>
      {trailingIcon && (
        <div
          className="zd:flex zd:shrink-0 zd:items-center zd:rounded-full zd:p-2"
          data-testid="pill-trailing-icon"
        >
          {trailingIcon}
        </div>
      )}
    </Wrapper>
  )
}
