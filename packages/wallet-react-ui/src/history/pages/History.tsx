import { Button, cn, Icon, Text, Wrapper } from '@zerodev/react-ui'
import { DataApiError, isQuotaExhaustedError } from '@zerodev/wallet-data'
import { Fragment, useEffect, useState } from 'react'
import { equalsIgnoreCase, shortenHex } from '../../shared/utils/common'
import {
  TX_HISTORY_STATUS_COLOR,
  TxHistoryItem,
  TxHistoryItemSkeleton,
} from '../components/TxHistoryItem'
import type { HistoryFeed, PendingTransaction, TxHistoryEntry } from '../types'
import { formatAge } from '../utils/format'
import { groupByDay } from '../utils/groupByDay'

export interface HistoryProps {
  feed: HistoryFeed
  /** Rows without a `transaction` stay inert. */
  onSelectEntry?: (entry: TxHistoryEntry) => void
}

export function History({ feed, onSelectEntry }: HistoryProps) {
  const pending = feed.status === 'ready' ? feed.pendingTransaction : undefined
  const unlisted = pending?.state === 'found' ? undefined : pending
  return (
    <div className="zd:flex zd:h-full zd:w-full zd:flex-col zd:pt-4 zd:pb-4">
      {feed.status === 'ready' && <RefreshBar feed={feed} />}
      <Wrapper
        variant="ghost"
        className="zd:flex zd:w-full zd:flex-1 zd:min-h-0 zd:flex-col zd:gap-1 zd:overflow-y-auto zd:rounded-2xl zd:p-2"
      >
        {feed.status === 'loading' && <Skeletons />}
        {feed.status === 'error' && (
          <ErrorState error={feed.error} onRetry={feed.retry} />
        )}
        {unlisted && <PendingRow {...unlisted} />}
        {feed.status === 'ready' && feed.entries.length === 0 && !unlisted && (
          <EmptyState />
        )}
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
                    highlighted={
                      pending?.state === 'found' &&
                      equalsIgnoreCase(entry.txHash, pending.txHash)
                    }
                    {...(onSelectEntry && { onSelect: onSelectEntry })}
                  />
                ))}
              </Fragment>
            ))}
            <LoadMore
              hasMore={feed.hasMore}
              loading={feed.loadingMore}
              onLoadMore={feed.loadMore}
              {...(feed.loadMoreError && { error: feed.loadMoreError })}
            />
          </>
        )}
      </Wrapper>
    </div>
  )
}

const FOUND_HIGHLIGHT_MS = 3_000

function Row({
  entry,
  highlighted,
  onSelect,
}: {
  entry: TxHistoryEntry
  highlighted: boolean
  onSelect?: (entry: TxHistoryEntry) => void
}) {
  const flash = useFlash(highlighted, FOUND_HIGHLIGHT_MS)
  const item = (
    <TxHistoryItem
      {...entry}
      className={cn(
        'zd:rounded-2xl zd:transition-colors zd:duration-700',
        flash && 'zd:bg-brand-primary/10',
      )}
    />
  )
  if (!onSelect || !entry.transaction) return item
  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      className="zd:w-full zd:cursor-pointer zd:rounded-2xl zd:text-left zd:hover:bg-neutral-secondary"
    >
      {item}
    </button>
  )
}

function useFlash(on: boolean, ms: number): boolean {
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (!on) return
    setFlash(true)
    const timer = setTimeout(() => setFlash(false), ms)
    return () => clearTimeout(timer)
  }, [on, ms])
  return flash
}

/** Stands in for a sent transaction the list doesn't show yet. Not
 * clickable: there is no transaction to open. */
function PendingRow({ txHash, state }: PendingTransaction) {
  const polling = state === 'polling'
  return (
    <output data-testid="tx-history-pending" className="zd:block">
      <div className="zd:flex zd:w-full zd:items-center zd:gap-2 zd:p-2">
        <div className="zd:flex zd:size-11 zd:shrink-0 zd:items-center zd:justify-center zd:rounded-xl zd:bg-bright-primary">
          <Icon name="hourglass" aria-hidden className="zd:size-5" />
        </div>
        <div className="zd:flex zd:min-w-0 zd:flex-1 zd:flex-col zd:gap-2">
          <Text className="zd:truncate zd:text-body1">
            {polling ? 'Waiting for transaction' : 'Not in history yet'}
          </Text>
          <div className="zd:flex zd:w-full zd:items-center zd:justify-between zd:gap-2">
            <Text className="zd:truncate zd:font-mono zd:text-body3">
              {shortenHex(txHash)}
            </Text>
            <Text
              className={cn(
                'zd:shrink-0 zd:text-body3',
                polling
                  ? TX_HISTORY_STATUS_COLOR.Pending
                  : 'zd:text-neutral-tertiary',
              )}
            >
              {polling ? 'Pending' : 'Check later'}
            </Text>
          </div>
        </div>
      </div>
      {!polling && (
        <Text className="zd:pb-2 zd:pl-15 zd:text-body3 zd:text-neutral-tertiary">
          It can take a few minutes. Tap Refresh to check again.
        </Text>
      )}
    </output>
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
      <Text className="zd:text-neutral-tertiary">No transactions yet</Text>
    </div>
  )
}

const ERROR_COPY: Partial<Record<number, string>> = {
  401: 'Your session expired. Sign in again.',
  429: 'Too many requests. Try again in a moment.',
}
const QUOTA_EXHAUSTED_COPY =
  'Transaction history is unavailable until next month: the monthly limit was reached.'
const GENERIC_ERROR_COPY = "Couldn't load transactions. Try again."

function errorMessage(error: Error): string {
  if (isQuotaExhaustedError(error)) return QUOTA_EXHAUSTED_COPY
  return (
    (error instanceof DataApiError && ERROR_COPY[error.status]) ||
    GENERIC_ERROR_COPY
  )
}

/**
 * A retry cannot fix an expired session or a spent monthly budget; the host has
 * to sign in again, or wait for the next UTC month.
 */
function canRetry(error: Error): boolean {
  if (isQuotaExhaustedError(error)) return false
  return !(error instanceof DataApiError && error.status === 401)
}

function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="zd:flex zd:flex-1 zd:flex-col zd:items-center zd:justify-center zd:gap-3 zd:py-8"
    >
      <Text className="zd:text-center zd:text-neutral-tertiary">
        {errorMessage(error)}
      </Text>
      {canRetry(error) && (
        <Button action="secondary" text="Try again" onClick={onRetry} />
      )}
    </div>
  )
}

function LoadMore({
  hasMore,
  loading,
  onLoadMore,
  error,
}: {
  hasMore: boolean
  loading: boolean
  onLoadMore: () => void
  error?: Error
}) {
  if (!hasMore) return null
  return (
    <div className="zd:flex zd:flex-col zd:items-center zd:gap-2 zd:py-2">
      {error && (
        <Text role="alert" className="zd:text-center zd:text-neutral-tertiary">
          {errorMessage(error)}
        </Text>
      )}
      <Button
        action="secondary"
        text={loading ? 'Loading…' : 'Load more'}
        onClick={onLoadMore}
        disabled={loading}
      />
    </div>
  )
}

/** Each refresh spends one of the wallet's monthly Data API lookups, so a
 * click locks the button for a while. */
const REFRESH_COOLDOWN_MS = 10_000
const AGE_TICK_MS = 30_000

function RefreshBar({
  feed,
}: {
  feed: Extract<HistoryFeed, { status: 'ready' }>
}) {
  const now = useNow(AGE_TICK_MS)
  const [coolingDown, setCoolingDown] = useState(false)
  useEffect(() => {
    if (!coolingDown) return
    const timer = setTimeout(() => setCoolingDown(false), REFRESH_COOLDOWN_MS)
    return () => clearTimeout(timer)
  }, [coolingDown])

  const { refreshError, refreshing, updatedAt } = feed
  return (
    <div className="zd:flex zd:h-7 zd:items-center zd:justify-between zd:gap-2 zd:pb-1 zd:pl-2">
      {refreshError && !refreshing ? (
        <Text role="alert" className="zd:text-body3 zd:text-error-primary">
          {errorMessage(refreshError)}
        </Text>
      ) : (
        <Text className="zd:text-body3 zd:text-neutral-tertiary">
          {refreshing
            ? 'Updating…'
            : updatedAt !== undefined &&
              `Updated ${formatAge(now - updatedAt * 1000)}`}
        </Text>
      )}
      {!(refreshError && !canRetry(refreshError)) && (
        <button
          type="button"
          disabled={refreshing || coolingDown}
          onClick={() => {
            setCoolingDown(true)
            feed.refresh()
          }}
          className="zd:inline-flex zd:shrink-0 zd:cursor-pointer zd:items-center zd:gap-1 zd:rounded-xl zd:px-2 zd:py-1 zd:font-sans zd:text-body3 zd:text-neutral-primary zd:hover:bg-neutral-secondary zd:disabled:cursor-default zd:disabled:text-neutral-tertiary zd:disabled:hover:bg-transparent"
        >
          <Icon
            name="refresh"
            aria-hidden
            className={cn('zd:h-3.5 zd:w-3.5', refreshing && 'zd:animate-spin')}
          />
          {refreshError ? 'Retry' : 'Refresh'}
        </button>
      )}
    </div>
  )
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
