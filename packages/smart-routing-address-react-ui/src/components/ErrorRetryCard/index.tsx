import { cn, Icon, Text } from '@zerodev/react-ui'

export interface ErrorRetryCardProps {
  /** Error copy shown on the left side, e.g. "Failed to create deposit
   * address…" — kept short (Figma design truncates on one line). */
  message: string
  /** Called when the user clicks the refresh affordance. */
  onRetry: () => void
  /** Marks the button as busy while a retry is in flight — disables clicks
   * and spins the icon so back-to-back taps don't stack requests. */
  busy?: boolean
  /** Accessible label for the icon-only refresh button. Defaults to "Retry". */
  retryLabel?: string
  className?: string
}

/**
 * Error banner with an inline retry affordance. Renders as a compact pill
 * matching the Figma spec (`bg-negative/10`, error-red text, right-hand
 * 52×52 refresh button). Used above the "Min deposit" row in the deposit UI
 * to surface address-creation, empty-route and polling failures.
 */
export function ErrorRetryCard({
  message,
  onRetry,
  busy,
  retryLabel = 'Retry',
  className,
}: ErrorRetryCardProps) {
  return (
    <div
      role="alert"
      className={cn(
        'zd:relative zd:flex zd:w-full zd:items-center zd:justify-center zd:gap-3',
        'zd:overflow-hidden zd:rounded-[14px] zd:border-[0.3px] zd:border-neutral-primary',
        'zd:bg-error-subtle zd:backdrop-blur-[15px] zd:py-2 zd:pr-2 zd:pl-4',
        'zd:shadow-[inset_0_-4px_4px_0_rgba(255,255,255,0.1),inset_0_3px_4px_0_rgba(0,0,0,0.02)]',
        className,
      )}
    >
      <Text className="zd:flex-1 zd:min-w-0 zd:text-body1 zd:font-medium zd:text-error-primary">
        {message}
      </Text>
      <button
        type="button"
        onClick={onRetry}
        disabled={busy}
        aria-label={retryLabel}
        aria-busy={busy}
        className={cn(
          'zd:inline-flex zd:h-[52px] zd:w-[52px] zd:shrink-0 zd:items-center zd:justify-center',
          'zd:rounded-2xl zd:bg-error-subtle zd:text-icon-error-primary zd:cursor-pointer',
          'zd:transition-colors zd:hover:bg-error-bold/20',
          'zd:disabled:cursor-not-allowed zd:disabled:opacity-50',
        )}
      >
        <Icon
          name="rotateRight"
          className={cn(
            'zd:h-6 zd:w-6 zd:text-icon-error-primary',
            busy && 'zd:animate-spin',
          )}
          aria-hidden
        />
      </button>
    </div>
  )
}
