import { renderHook, waitFor } from '@testing-library/react'
import { getSmartRoutingAddressStatus } from '@zerodev/smart-routing-address'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDeposit, SMART_ROUTING_ADDRESS } from '../test/fixtures'
import { useDepositStatus } from './useDepositStatus'

vi.mock('@zerodev/smart-routing-address', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@zerodev/smart-routing-address')>()
  return {
    ...actual,
    getSmartRoutingAddressStatus: vi.fn(),
  }
})

const mockedGetStatus = vi.mocked(getSmartRoutingAddressStatus)

describe('useDepositStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does nothing while disabled or without an address', () => {
    renderHook(() => useDepositStatus({ address: undefined, enabled: true }))
    renderHook(() =>
      useDepositStatus({
        address: SMART_ROUTING_ADDRESS,
        enabled: false,
      }),
    )
    expect(mockedGetStatus).not.toHaveBeenCalled()
  })

  it('fetches immediately and keeps polling', async () => {
    const deposit = makeDeposit()
    mockedGetStatus.mockResolvedValue({
      deposits: [deposit],
      totalCount: 1,
      nextPage: null,
      totalPages: 1,
    })

    const { result, unmount } = renderHook(() =>
      useDepositStatus({
        address: SMART_ROUTING_ADDRESS,
        pollingInterval: 20,
      }),
    )

    await waitFor(() => {
      expect(result.current.hasLoaded).toBe(true)
    })
    expect(result.current.deposits).toEqual([deposit])
    expect(result.current.totalCount).toBe(1)

    await waitFor(() => {
      expect(mockedGetStatus.mock.calls.length).toBeGreaterThan(1)
    })
    unmount()
  })

  it('captures polling errors without clearing previous data', async () => {
    const deposit = makeDeposit()
    mockedGetStatus
      .mockResolvedValueOnce({
        deposits: [deposit],
        totalCount: 1,
        nextPage: null,
        totalPages: 1,
      })
      .mockRejectedValue(new Error('network down'))

    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const { result, unmount } = renderHook(() =>
      useDepositStatus({
        address: SMART_ROUTING_ADDRESS,
        pollingInterval: 20,
      }),
    )

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error)
    })
    expect(result.current.deposits).toEqual([deposit])

    unmount()
    consoleSpy.mockRestore()
  })
})
