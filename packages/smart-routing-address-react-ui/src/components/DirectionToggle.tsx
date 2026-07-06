import { cn, Icon, Wrapper } from '@zerodev/react-ui'

/**
 * The 44px arrow-down button that sits between the "Send" and "Arrives as"
 * cards. Purely decorative for now — clicking does nothing until we wire in
 * source↔dest direction switching.
 */
export function DirectionToggle({
  className,
  onClick,
}: {
  className?: string
  onClick?: () => void
}) {
  return (
    <Wrapper
      variant="ghost"
      className={cn(
        'zd:rounded-xl zd:flex zd:items-center zd:justify-center',
        onClick && 'zd:cursor-pointer',
        className,
      )}
      style={{ width: 44, height: 44 }}
      {...(onClick && {
        role: 'button',
        tabIndex: 0,
        onClick,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        },
      })}
    >
      <Icon
        name="arrowSquareDown"
        className="zd:w-6 zd:h-6 zd:text-greyScale"
      />
    </Wrapper>
  )
}
