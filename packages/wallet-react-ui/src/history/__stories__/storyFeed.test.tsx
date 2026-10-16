import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { receiveTx, sendTx, swapTx } from '../fixtures'
import type { HistoryFeed } from '../types'
import { useScenarioFeed } from './storyFeed'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const pages = [[sendTx], [receiveTx], [swapTx]]

function ready(feed: HistoryFeed) {
  if (feed.status !== 'ready') throw new Error(`Feed is ${feed.status}`)
  return feed
}

describe('useScenarioFeed', () => {
  it('appends pages until the last one', () => {
    const { result } = renderHook(() => useScenarioFeed({ pages }))
    expect(ready(result.current).entries).toHaveLength(1)
    expect(ready(result.current).hasMore).toBe(true)

    act(() => ready(result.current).loadMore())
    expect(ready(result.current).loadingMore).toBe(true)
    act(() => vi.advanceTimersByTime(800))
    expect(ready(result.current).entries).toHaveLength(2)

    act(() => ready(result.current).loadMore())
    act(() => vi.advanceTimersByTime(800))
    expect(ready(result.current).entries).toHaveLength(3)
    expect(ready(result.current).hasMore).toBe(false)
  })

  it('retries from the error state into the first page', () => {
    const error = new Error('boom')
    const { result } = renderHook(() =>
      useScenarioFeed({ pages, failWith: error }),
    )
    const feed = result.current
    if (feed.status !== 'error') throw new Error(`Feed is ${feed.status}`)
    expect(feed.error).toBe(error)

    act(() => feed.retry())
    expect(result.current.status).toBe('loading')
    act(() => vi.advanceTimersByTime(800))
    expect(ready(result.current).entries).toHaveLength(1)
  })

  it('fails the second page once, then appends it', () => {
    const error = new Error('next failed')
    const { result } = renderHook(() =>
      useScenarioFeed({ pages, failOnNext: error }),
    )

    act(() => ready(result.current).loadMore())
    act(() => vi.advanceTimersByTime(800))
    expect(ready(result.current).loadMoreError).toBe(error)
    expect(ready(result.current).entries).toHaveLength(1)

    act(() => ready(result.current).loadMore())
    expect(ready(result.current).loadMoreError).toBeUndefined()
    act(() => vi.advanceTimersByTime(800))
    expect(ready(result.current).entries).toHaveLength(2)
  })
})
