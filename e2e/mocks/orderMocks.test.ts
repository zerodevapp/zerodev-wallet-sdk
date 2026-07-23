import { describe, expect, it } from 'vitest'
import { orderMocks } from './orderMocks.js'
import type { MockRequest } from './types.js'

const mock = (label: string, priority?: number): MockRequest => ({
  url: `https://example.test/${label}`,
  method: 'GET',
  response: { label },
  ...(priority !== undefined && { priority }),
})

describe('orderMocks', () => {
  it('orders higher priority first', () => {
    const low = mock('low', 1)
    const high = mock('high', 5)
    const mid = mock('mid', 3)

    const ordered = orderMocks([low, high, mid])

    expect(ordered.map((m) => m.response)).toEqual([
      high.response,
      mid.response,
      low.response,
    ])
  })

  it('treats a missing priority as 0', () => {
    const explicitZero = mock('explicit-zero', 0)
    const positive = mock('positive', 2)
    const negative = mock('negative', -1)
    const noPriority = mock('no-priority') // undefined -> 0

    const ordered = orderMocks([negative, noPriority, explicitZero, positive])

    expect(ordered.map((m) => m.response)).toEqual([
      positive.response,
      // noPriority and explicitZero tie at 0; input order is preserved
      noPriority.response,
      explicitZero.response,
      negative.response,
    ])
  })

  it('is stable for equal priorities (preserves input order)', () => {
    const first = mock('first', 2)
    const second = mock('second', 2)
    const third = mock('third', 2)

    const ordered = orderMocks([first, second, third])

    expect(ordered.map((m) => m.response)).toEqual([
      first.response,
      second.response,
      third.response,
    ])
  })

  it('does not mutate the input array', () => {
    const a = mock('a', 1)
    const b = mock('b', 2)
    const input = [a, b]

    orderMocks(input)

    expect(input).toEqual([a, b])
  })
})
