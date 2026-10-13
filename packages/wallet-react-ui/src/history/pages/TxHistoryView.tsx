import { Screen, TopNav } from '@zerodev/react-ui'
import { useState } from 'react'
import type { HistoryFeed } from '../types'
import { History } from './History'
import { TransactionDetails } from './TransactionDetails'

export interface TxHistoryViewProps {
  feed: HistoryFeed
  onClose: () => void
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function TxHistoryView({
  feed,
  onClose,
  className,
  size,
}: TxHistoryViewProps) {
  const [selectedId, setSelectedId] = useState<string>()
  const selected =
    feed.status === 'ready'
      ? feed.entries.find((entry) => entry.id === selectedId)?.transaction
      : undefined

  return (
    <Screen
      {...(className && { className })}
      {...(size && { size })}
      topNav={
        <TopNav
          title={selected ? 'Transaction details' : 'History'}
          {...(selected && {
            leftButtonIcon: 'chevronLeft',
            onLeftButtonClick: () => setSelectedId(undefined),
          })}
          onRightButtonClick={onClose}
        />
      }
    >
      {selected ? (
        <TransactionDetails transaction={selected} />
      ) : (
        <History
          feed={feed}
          onSelectEntry={(entry) => setSelectedId(entry.id)}
        />
      )}
    </Screen>
  )
}
