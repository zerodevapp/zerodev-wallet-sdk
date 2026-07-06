import { cn, Icon, Text, Wrapper } from '@zerodev/react-ui'

/**
 * The "Watching for your deposit on Base…" card at the bottom of the flow.
 * Shows a loading spinner + status text; will later show detected-deposit
 * rows with progress bars when we port the ActiveDeposits UI.
 */
export function SmartFundingCard({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  return (
    <Wrapper
      variant="ghost"
      className={cn(
        'zd:rounded-2xl zd:flex zd:flex-col zd:items-center zd:justify-center zd:p-4 zd:w-full',
        className,
      )}
      style={{ gap: 24 }}
    >
      <div className="zd:flex zd:h-7 zd:items-center zd:w-full">
        <div className="zd:flex zd:flex-1 zd:gap-2 zd:items-center zd:justify-center">
          <Icon
            name="lineLoading"
            className="zd:w-4 zd:h-4 zd:text-greyScale"
          />
          <Text
            className="zd:opacity-50 zd:flex-1"
            style={{ fontSize: '16px' }}
          >
            {text}
          </Text>
        </div>
      </div>
    </Wrapper>
  )
}
