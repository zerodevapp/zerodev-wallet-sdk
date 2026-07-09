import { act, render, renderHook, waitFor } from '@testing-library/react'
import {
  createSmartRoutingAddress,
  SMART_ROUTING_ADDRESS_SERVER_URL,
} from '@zerodev/smart-routing-address'
import type { ReactNode } from 'react'
import type { Address } from 'viem'
import { arbitrum, base } from 'viem/chains'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SmartRoutingAddressProvider } from '../context/SmartRoutingAddressProvider'
import { OWNER, SMART_ROUTING_ADDRESS, TEST_CONFIG } from '../test/fixtures'
import type { SmartRoutingAddressConfig } from '../types'
import { resolveActions, resolveSourceTokens } from '../utils/config'
import type { UseSmartRoutingAddressResult } from './useSmartRoutingAddress'
import { useSmartRoutingAddress } from './useSmartRoutingAddress'

vi.mock('@zerodev/smart-routing-address', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@zerodev/smart-routing-address')>()
  return {
    ...actual,
    createSmartRoutingAddress: vi.fn(),
  }
})

const OTHER_RECIPIENT: Address = '0x4444444444444444444444444444444444444444'
const STALE_ADDRESS: Address = '0x9999999999999999999999999999999999999999'

type CreateResult = Awaited<ReturnType<typeof createSmartRoutingAddress>>

/** A promise that can be settled manually from the test body */
function deferred() {
  let resolveFn: ((value: CreateResult) => void) | undefined
  let rejectFn: ((reason?: unknown) => void) | undefined
  const promise = new Promise<CreateResult>((resolve, reject) => {
    resolveFn = resolve
    rejectFn = reject
  })
  return {
    promise,
    resolve: (value: CreateResult) => resolveFn?.(value),
    reject: (reason?: unknown) => rejectFn?.(reason),
  }
}

function renderWithProvider() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SmartRoutingAddressProvider config={TEST_CONFIG}>
      {children}
    </SmartRoutingAddressProvider>
  )
  return renderHook(() => useSmartRoutingAddress(), { wrapper })
}

describe('useSmartRoutingAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createSmartRoutingAddress).mockResolvedValue({
      smartRoutingAddress: SMART_ROUTING_ADDRESS,
      estimatedFees: [],
    })
  })

  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useSmartRoutingAddress())).toThrow(
      /SmartRoutingAddressProvider/,
    )
  })

  it('exposes the address state and shares one creation request', async () => {
    const { result } = renderWithProvider()

    expect(result.current.addressState.status).toBe('idle')

    await act(() =>
      Promise.all([
        result.current.ensureAddress(OWNER),
        result.current.ensureAddress(OWNER),
      ]),
    )
    expect(createSmartRoutingAddress).toHaveBeenCalledTimes(1)
  })

  it('creates the address with resolved chains and the recipient as owner', async () => {
    const { result } = renderWithProvider()

    await act(() => result.current.ensureAddress(OWNER))

    expect(createSmartRoutingAddress).toHaveBeenCalledWith({
      owner: OWNER,
      destChain: base,
      slippage: TEST_CONFIG.slippage,
      srcTokens: resolveSourceTokens(TEST_CONFIG),
      actions: resolveActions(TEST_CONFIG, OWNER),
      allowPartialRoutes: true,
      config: {
        baseUrl: `${SMART_ROUTING_ADDRESS_SERVER_URL}/${TEST_CONFIG.projectId}`,
        version: '0.2.1',
      },
    })
  })

  it('reuses the result for repeat calls with the same recipient', async () => {
    const { result } = renderWithProvider()

    await act(() => result.current.ensureAddress(OWNER))
    await act(() => result.current.ensureAddress(OWNER))

    expect(createSmartRoutingAddress).toHaveBeenCalledTimes(1)
  })

  it('creates a fresh address when called with a different recipient', async () => {
    const { result } = renderWithProvider()

    await act(() => result.current.ensureAddress(OWNER))
    await act(() => result.current.ensureAddress(OTHER_RECIPIENT))

    expect(createSmartRoutingAddress).toHaveBeenCalledTimes(2)
    expect(createSmartRoutingAddress).toHaveBeenLastCalledWith(
      expect.objectContaining({
        owner: OTHER_RECIPIENT,
      }),
    )
    await waitFor(() => {
      expect(result.current.addressState.status).toBe('success')
    })
  })
})

describe('ensureAddress race handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('settles on one consistent success after switching recipients and back', async () => {
    const firstForA = deferred()
    const forB = deferred()
    const secondForA = deferred()
    vi.mocked(createSmartRoutingAddress)
      .mockReturnValueOnce(firstForA.promise)
      .mockReturnValueOnce(forB.promise)
      .mockReturnValueOnce(secondForA.promise)

    const { result } = renderWithProvider()

    let first: Promise<void> = Promise.resolve()
    let third: Promise<void> = Promise.resolve()
    await act(async () => {
      first = result.current.ensureAddress(OWNER)
    })
    await act(async () => {
      result.current.ensureAddress(OTHER_RECIPIENT).catch(() => {})
    })
    await act(async () => {
      third = result.current.ensureAddress(OWNER)
    })

    // Dedupe contract: only a pending request for the SAME recipient is
    // shared, so switching away and back re-requests A
    expect(createSmartRoutingAddress).toHaveBeenCalledTimes(3)

    // The superseded first request for A must not write state
    await act(async () => {
      firstForA.resolve({
        smartRoutingAddress: STALE_ADDRESS,
        estimatedFees: [],
      })
      await first
    })
    expect(result.current.addressState.status).toBe('loading')

    // The superseded request for B must not write state either
    await act(async () => {
      forB.resolve({
        smartRoutingAddress: STALE_ADDRESS,
        estimatedFees: [],
      })
    })
    expect(result.current.addressState.status).toBe('loading')

    // Only the live request for A settles the state
    await act(async () => {
      secondForA.resolve({
        smartRoutingAddress: SMART_ROUTING_ADDRESS,
        estimatedFees: [],
      })
      await third
    })
    expect(result.current.addressState).toMatchObject({
      status: 'success',
      address: SMART_ROUTING_ADDRESS,
    })
  })

  it('ignores a stale success after a recipient switch', async () => {
    const forA = deferred()
    const forB = deferred()
    vi.mocked(createSmartRoutingAddress)
      .mockReturnValueOnce(forA.promise)
      .mockReturnValueOnce(forB.promise)

    const { result } = renderWithProvider()

    let first: Promise<void> = Promise.resolve()
    let second: Promise<void> = Promise.resolve()
    await act(async () => {
      first = result.current.ensureAddress(OWNER)
    })
    await act(async () => {
      second = result.current.ensureAddress(OTHER_RECIPIENT)
    })

    await act(async () => {
      forA.resolve({
        smartRoutingAddress: STALE_ADDRESS,
        estimatedFees: [],
      })
      await first
    })
    expect(result.current.addressState.status).toBe('loading')

    await act(async () => {
      forB.resolve({
        smartRoutingAddress: SMART_ROUTING_ADDRESS,
        estimatedFees: [],
      })
      await second
    })
    expect(result.current.addressState).toMatchObject({
      status: 'success',
      address: SMART_ROUTING_ADDRESS,
    })
  })

  it('ignores a stale failure and keeps the live request deduped', async () => {
    const forA = deferred()
    const forB = deferred()
    vi.mocked(createSmartRoutingAddress)
      .mockReturnValueOnce(forA.promise)
      .mockReturnValueOnce(forB.promise)

    const { result } = renderWithProvider()

    let first: Promise<void> = Promise.resolve()
    let second: Promise<void> = Promise.resolve()
    await act(async () => {
      first = result.current.ensureAddress(OWNER)
    })
    await act(async () => {
      second = result.current.ensureAddress(OTHER_RECIPIENT)
    })

    await act(async () => {
      forA.reject(new Error('boom'))
      await first
    })
    expect(result.current.addressState.status).toBe('loading')

    // The pending request for B is still shared (not cleared by the
    // stale failure)
    await act(async () => {
      result.current.ensureAddress(OTHER_RECIPIENT).catch(() => {})
    })
    expect(createSmartRoutingAddress).toHaveBeenCalledTimes(2)

    await act(async () => {
      forB.resolve({
        smartRoutingAddress: SMART_ROUTING_ADDRESS,
        estimatedFees: [],
      })
      await second
    })
    expect(result.current.addressState).toMatchObject({
      status: 'success',
      address: SMART_ROUTING_ADDRESS,
    })
  })

  it('recreates the address with new params after a config change', async () => {
    vi.mocked(createSmartRoutingAddress).mockResolvedValue({
      smartRoutingAddress: SMART_ROUTING_ADDRESS,
      estimatedFees: [],
    })

    const captured: { current: UseSmartRoutingAddressResult | null } = {
      current: null,
    }
    function Probe() {
      captured.current = useSmartRoutingAddress()
      return null
    }
    function Harness({ config }: { config: SmartRoutingAddressConfig }) {
      return (
        <SmartRoutingAddressProvider config={config}>
          <Probe />
        </SmartRoutingAddressProvider>
      )
    }

    const { rerender } = render(<Harness config={TEST_CONFIG} />)

    await act(async () => {
      await captured.current?.ensureAddress(OWNER)
    })
    expect(createSmartRoutingAddress).toHaveBeenCalledTimes(1)

    const newConfig: SmartRoutingAddressConfig = {
      ...TEST_CONFIG,
      targetChainId: arbitrum.id,
    }
    rerender(<Harness config={newConfig} />)

    await act(async () => {
      await captured.current?.ensureAddress(OWNER)
    })
    expect(createSmartRoutingAddress).toHaveBeenCalledTimes(2)
    expect(createSmartRoutingAddress).toHaveBeenLastCalledWith(
      expect.objectContaining({
        owner: OWNER,
        destChain: arbitrum,
      }),
    )
  })
})
