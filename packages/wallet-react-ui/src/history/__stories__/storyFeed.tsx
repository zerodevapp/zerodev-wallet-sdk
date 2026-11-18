import type { TransactionHistoryItem } from '@zerodev/wallet-data'
import { useEffect, useMemo, useReducer } from 'react'
import type { HistoryFeed } from '../types'
import { toTxHistoryEntry } from '../utils/toTxHistoryEntry'

export interface ScenarioFeedOptions {
  pages: readonly (readonly TransactionHistoryItem[])[]
  /** Start in the error state; retry then succeeds. */
  failWith?: Error
  /** Fail the first attempt at loading the second page; the next one succeeds. */
  failOnNext?: Error
  /** Fail every refresh; the loaded entries stay. */
  failOnRefresh?: Error
  delayMs?: number
}

type FeedState =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | {
      status: 'ready'
      pageIndex: number
      loadingMore: boolean
      loadMoreError?: Error
      armedFailure?: Error
      refreshing: boolean
      refreshError?: Error
      updatedAt: number
    }

type FeedAction =
  | { type: 'retry' }
  | { type: 'loaded'; armedFailure: Error | undefined }
  | { type: 'loadMore'; pageCount: number }
  | { type: 'loadMoreSettled' }
  | { type: 'refresh' }
  | { type: 'refreshSettled'; error: Error | undefined }

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

function ready(pageIndex: number, armedFailure: Error | undefined): FeedState {
  return {
    status: 'ready',
    pageIndex,
    loadingMore: false,
    refreshing: false,
    updatedAt: nowSeconds(),
    ...(armedFailure && { armedFailure }),
  }
}

function reducer(state: FeedState, action: FeedAction): FeedState {
  switch (action.type) {
    case 'retry':
      return state.status === 'error' ? { status: 'loading' } : state
    case 'loaded':
      return state.status === 'loading' ? ready(0, action.armedFailure) : state
    case 'loadMore': {
      if (state.status !== 'ready' || state.loadingMore) return state
      if (state.pageIndex >= action.pageCount - 1) return state
      const { loadMoreError: _, ...rest } = state
      return { ...rest, loadingMore: true }
    }
    case 'loadMoreSettled': {
      if (state.status !== 'ready' || !state.loadingMore) return state
      if (state.armedFailure && state.pageIndex === 0) {
        const { armedFailure, ...rest } = state
        return { ...rest, loadingMore: false, loadMoreError: armedFailure }
      }
      const { loadMoreError: _, ...rest } = state
      return { ...rest, pageIndex: state.pageIndex + 1, loadingMore: false }
    }
    case 'refresh':
      if (state.status !== 'ready' || state.refreshing) return state
      return { ...state, refreshing: true }
    case 'refreshSettled': {
      if (state.status !== 'ready' || !state.refreshing) return state
      const { refreshError: _, ...rest } = state
      return action.error
        ? { ...rest, refreshing: false, refreshError: action.error }
        : { ...rest, refreshing: false, updatedAt: nowSeconds() }
    }
  }
}

/** A HistoryFeed driven by fixture pages, with fake latency, for stories. */
export function useScenarioFeed({
  pages,
  failWith,
  failOnNext,
  failOnRefresh,
  delayMs = 800,
}: ScenarioFeedOptions): HistoryFeed {
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    (): FeedState =>
      failWith ? { status: 'error', error: failWith } : ready(0, failOnNext),
  )

  const inFlight =
    state.status === 'loading'
      ? 'loading'
      : state.status === 'ready' && state.loadingMore
        ? 'loadingMore'
        : state.status === 'ready' && state.refreshing
          ? 'refreshing'
          : undefined
  useEffect(() => {
    if (!inFlight) return
    const timer = setTimeout(
      () =>
        dispatch(
          inFlight === 'loading'
            ? { type: 'loaded', armedFailure: failOnNext }
            : inFlight === 'loadingMore'
              ? { type: 'loadMoreSettled' }
              : { type: 'refreshSettled', error: failOnRefresh },
        ),
      delayMs,
    )
    return () => clearTimeout(timer)
  }, [inFlight, delayMs, failOnNext, failOnRefresh])

  const pageIndex = state.status === 'ready' ? state.pageIndex : 0
  const entries = useMemo(
    () =>
      pages
        .slice(0, pageIndex + 1)
        .flat()
        .flatMap((item) => toTxHistoryEntry(item) ?? []),
    [pages, pageIndex],
  )

  if (state.status === 'loading') return { status: 'loading' }
  if (state.status === 'error') {
    return {
      status: 'error',
      error: state.error,
      retry: () => dispatch({ type: 'retry' }),
    }
  }
  return {
    status: 'ready',
    entries,
    hasMore: state.pageIndex < pages.length - 1,
    loadingMore: state.loadingMore,
    loadMore: () => dispatch({ type: 'loadMore', pageCount: pages.length }),
    ...(state.loadMoreError && { loadMoreError: state.loadMoreError }),
    refreshing: state.refreshing,
    refresh: () => dispatch({ type: 'refresh' }),
    ...(state.refreshError && { refreshError: state.refreshError }),
    updatedAt: state.updatedAt,
  }
}
