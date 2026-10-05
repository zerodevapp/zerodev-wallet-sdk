import { Button, Text, Wrapper } from '@zerodev/react-ui'
import { DataApiError } from '@zerodev/wallet-data'
import { Fragment } from 'react'
import {
  TxHistoryItem,
  TxHistoryItemSkeleton,
} from '../components/TxHistoryItem'
import type { HistoryFeed, TxHistoryEntry } from '../types'
import { groupByDay } from '../utils/groupByDay'

export interface HistoryProps {
  feed: HistoryFeed
  /** Rows without a `transaction` stay inert. */
  onSelectEntry?: (entry: TxHistoryEntry) => void
}

export function History({ feed, onSelectEntry }: HistoryProps) {
  return (
    <div className="zd:flex zd:h-full zd:w-full zd:flex-col zd:pt-2 zd:pb-4">
      <Wrapper
        variant="ghost"
        className="zd:flex zd:w-full zd:flex-1 zd:min-h-0 zd:flex-col zd:gap-1 zd:overflow-y-auto zd:rounded-2xl zd:p-2"
      >
        {feed.status === 'loading' && <Skeletons />}
        {feed.status === 'error' && (
          <ErrorState error={feed.error} onRetry={feed.retry} />
        )}
        {feed.status === 'ready' && feed.entries.length === 0 && <EmptyState />}
        {feed.status === 'ready' && feed.entries.length > 0 && (
          <>
            {groupByDay(feed.entries).map((group) => (
              <Fragment key={group.label}>
                <div className="zd:py-2 zd:pr-2">
                  <Text className="zd:text-body3">{group.label}</Text>
                </div>
                {group.entries.map((entry) => (
                  <Row
                    key={entry.id}
                    entry={entry}
                    {...(onSelectEntry && { onSelect: onSelectEntry })}
                  />
                ))}
              </Fragment>
            ))}
            <LoadMore
              hasMore={feed.hasMore}
              loading={feed.loadingMore}
              onLoadMore={feed.loadMore}
            />
          </>
        )}
      </Wrapper>
    </div>
  )
}

function Row({
  entry,
  onSelect,
}: {
  entry: TxHistoryEntry
  onSelect?: (entry: TxHistoryEntry) => void
}) {
  const item = <TxHistoryItem {...entry} />
  if (!onSelect || !entry.transaction) return item
  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      className="zd:w-full zd:cursor-pointer zd:rounded-2xl zd:text-left zd:hover:bg-white/30"
    >
      {item}
    </button>
  )
}

function Skeletons() {
  return (
    <output aria-label="Loading transactions" className="zd:flex zd:flex-col">
      <TxHistoryItemSkeleton />
      <TxHistoryItemSkeleton />
      <TxHistoryItemSkeleton />
      <TxHistoryItemSkeleton />
    </output>
  )
}

function EmptyState() {
  return (
    <div className="zd:flex zd:flex-1 zd:items-center zd:justify-center zd:py-8">
      <Text className="zd:text-greyScale/50">No transactions yet</Text>
    </div>
  )
}

function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const message =
    error instanceof DataApiError && error.status === 401
      ? 'Your session expired. Sign in again.'
      : error.message
  return (
    <div
      role="alert"
      className="zd:flex zd:flex-1 zd:flex-col zd:items-center zd:justify-center zd:gap-3 zd:py-8"
    >
      <Text className="zd:text-center zd:text-greyScale/50">{message}</Text>
      <Button action="secondary" text="Try again" onClick={onRetry} />
    </div>
  )
}

function LoadMore({
  hasMore,
  loading,
  onLoadMore,
}: {
  hasMore: boolean
  loading: boolean
  onLoadMore: () => void
}) {
  if (!hasMore) return null
  return (
    <div className="zd:flex zd:justify-center zd:py-2">
      <Button
        action="secondary"
        text={loading ? 'Loading…' : 'Load more'}
        onClick={onLoadMore}
        disabled={loading}
      />
    </div>
  )
}
