import type { ReactNode } from 'react'
import { cn } from '../../utils/common'
import { Icon } from '../Icon'
import { Text } from '../Text'
import { Tooltip } from '../Tooltip'

export type ProgressStepStatus = 'done' | 'active' | 'pending' | 'failed'

export interface ProgressStepProps {
  label: string
  status: ProgressStepStatus
  /** Tooltip copy behind a small info icon next to the label. */
  info?: string
  /** Trailing content, e.g. an explorer link, provider chip, or countdown. */
  right?: ReactNode
  /** Suppresses the connector line below the marker. */
  isLast?: boolean
  className?: string
}

/**
 * One row of a vertical progress trail: a status marker (with a connector
 * line down to the next step), a label, and an optional trailing slot.
 * Callers stack several in a column and mark the final one `isLast`.
 */
export function ProgressStep({
  label,
  status,
  info,
  right,
  isLast,
  className,
}: ProgressStepProps) {
  const done = status === 'done'
  const failed = status === 'failed'
  return (
    <div
      className={cn(
        'zd:relative zd:flex zd:w-full zd:items-start zd:gap-3',
        className,
      )}
    >
      <div className="zd:flex zd:flex-col zd:items-center zd:pt-0.5">
        <StatusMark status={status} />
        {!isLast && (
          <div
            className={cn(
              'zd:mt-1 zd:h-4 zd:w-px',
              done ? 'zd:bg-solarOrange/60' : 'zd:bg-greyScale/20',
            )}
          />
        )}
      </div>
      <div className="zd:flex zd:min-w-0 zd:flex-1 zd:items-center zd:gap-1">
        <Text
          className={cn(
            'zd:whitespace-nowrap',
            failed
              ? 'zd:text-negative'
              : // Mute the label until the step is done so a final row with
                // an inert open circle doesn't read at full intensity while
                // earlier steps are still in flight.
                done
                ? 'zd:text-greyScale'
                : 'zd:text-greyScale/60',
          )}
        >
          {label}
        </Text>
        {info && (
          <Tooltip content={info}>
            <button
              type="button"
              aria-label="More info"
              className="zd:inline-flex zd:items-center zd:justify-center zd:cursor-help zd:outline-none zd:bg-transparent"
            >
              <Icon
                name="info"
                className="zd:w-3 zd:h-3 zd:text-greyScale/50"
                aria-hidden
              />
            </button>
          </Tooltip>
        )}
      </div>
      <div className="zd:flex zd:shrink-0 zd:items-center">{right}</div>
    </div>
  )
}

function StatusMark({ status }: { status: ProgressStepStatus }) {
  switch (status) {
    case 'failed':
      return (
        <Icon
          name="warning"
          className="zd:size-4 zd:text-negative"
          aria-hidden
        />
      )
    case 'done':
      return (
        <span className="zd:inline-flex zd:size-4 zd:items-center zd:justify-center zd:rounded-full zd:bg-solarOrange">
          <Icon name="check" className="zd:size-3 zd:text-white" aria-hidden />
        </span>
      )
    case 'active':
      return (
        <Icon
          name="loading"
          className="zd:size-4 zd:animate-spin zd:text-solarOrange"
          aria-hidden
          data-testid="progress-step-spinner"
        />
      )
    default:
      return (
        <span className="zd:inline-block zd:size-4 zd:rounded-full zd:border zd:border-greyScale/30" />
      )
  }
}
