import { Screen, TopNav } from '@zerodev/react-ui'
import { useState } from 'react'
import type { TxHistoryEntry } from '../types'
import { History } from './History'

/** Current page within the history flow. Single page for now — a
 * transaction-details step slots in beside it later. */
export type TxHistoryStep = 'history'

const TITLE_BY_STEP: Record<TxHistoryStep, string> = {
  history: 'History',
}

export interface TxHistoryProps {
  /** Called when the top-right × close button is clicked. */
  onClose: () => void
  /** Activity feed; defaults to the mock feed until a real source lands. */
  entries?: TxHistoryEntry[] | undefined
  /** Fired when a row is tapped. Rows are inert when omitted. */
  onSelectEntry?: ((entry: TxHistoryEntry) => void) | undefined
  className?: string | undefined
  size?: 'sm' | 'md' | 'lg' | undefined
}

/**
 * Transaction history widget.
 *
 * Owns the shared `Screen` + `TopNav` chrome and delegates the body to the
 * current page in this directory — mirrors the layout of
 * `smart-routing-address-react-ui`'s `pages/index.tsx`. Navigation is owned
 * here: pages get callbacks, never the step setter.
 */
export function TxHistory({
  onClose,
  entries,
  onSelectEntry,
  className,
  size,
}: TxHistoryProps) {
  // Single step today, so the setter is unused; destructure it back in when
  // the first sub-page (transaction details) lands.
  const [step] = useState<TxHistoryStep>('history')

  const renderStep = () => {
    switch (step) {
      case 'history':
        return (
          <History
            {...(entries && { entries })}
            {...(onSelectEntry && { onSelectEntry })}
          />
        )
    }
  }

  // Sub-pages will swap the left slot for a back chevron returning to the
  // parent step (see SRA's pages/index.tsx); the root step has none.
  return (
    <Screen
      {...(className && { className })}
      {...(size && { size })}
      topNav={
        <TopNav title={TITLE_BY_STEP[step]} onRightButtonClick={onClose} />
      }
    >
      {renderStep()}
    </Screen>
  )
}
