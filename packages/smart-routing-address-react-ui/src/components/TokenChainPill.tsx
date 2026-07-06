import { cn, Icon, Text, Wrapper } from '@zerodev/react-ui'

/**
 * The USDC / Base / Arbitrum One selector pill from the Figma design.
 * Renders a rounded 52px-tall row with a 44px logo circle, label, and optional
 * chevron. The chevron is shown when `onClick` is provided (interactive
 * dropdown-style); otherwise the pill renders as static (used for the disabled
 * destination selectors in the "Arrives as" card).
 */
export function TokenChainPill({
  label,
  logoUri,
  logoBg = '#E6EFFB',
  logoInitial,
  onClick,
  disabled,
  className,
}: {
  label: string
  /** URL to a logo image; when omitted, a colored circle with `logoInitial` is shown. */
  logoUri?: string
  /** Fallback logo background color when no URI is supplied. */
  logoBg?: string
  /** Fallback initial rendered inside the placeholder circle. */
  logoInitial?: string
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  const interactive = Boolean(onClick) && !disabled
  return (
    <Wrapper
      variant={disabled ? 'soft' : 'solid'}
      className={cn(
        'zd:rounded-2xl zd:h-13 zd:flex zd:items-center zd:justify-between zd:pl-1 zd:pr-2 zd:py-1 zd:relative',
        interactive && 'zd:cursor-pointer',
        className,
      )}
      {...(interactive && {
        role: 'button',
        tabIndex: 0,
        onClick,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick?.()
          }
        },
      })}
    >
      <div className="zd:flex zd:items-center zd:gap-1.5 zd:relative">
        <div
          className="zd:relative zd:rounded-xl zd:shrink-0"
          style={{ width: 44, height: 44 }}
        >
          <div
            className="zd:absolute zd:top-1/2 zd:left-1/2 zd:-translate-x-1/2 zd:-translate-y-1/2 zd:rounded-full zd:overflow-hidden zd:flex zd:items-center zd:justify-center"
            style={{ width: 34, height: 34, background: logoBg }}
          >
            {logoUri ? (
              <img
                alt=""
                src={logoUri}
                className="zd:w-full zd:h-full zd:object-cover"
              />
            ) : logoInitial ? (
              <span className="zd:text-body2 zd:font-medium zd:text-white">
                {logoInitial}
              </span>
            ) : null}
          </div>
        </div>
        <Text className="zd:text-body1 zd:text-center zd:whitespace-nowrap">
          {label}
        </Text>
      </div>
      {interactive && (
        <div className="zd:flex zd:items-center zd:p-2 zd:rounded-full zd:shrink-0">
          <Icon
            name="chevronDown"
            className="zd:w-4 zd:h-4 zd:text-greyScale"
          />
        </div>
      )}
    </Wrapper>
  )
}
