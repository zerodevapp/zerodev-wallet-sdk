import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createStore } from '../../store'
import type { AuthConfig } from '../types'
import { useSendMagicLink } from './useSendMagicLink'

// --- mocks ---

const mockSendOtp = vi.fn()
let mockIsPending = false
let mockError: Error | null = null

vi.mock('@zerodev/wallet-react', () => ({
  useSendOTP: () => ({
    mutateAsync: mockSendOtp,
    isPending: mockIsPending,
    error: mockError,
  }),
}))

const mockConnector = {
  id: 'zerodev-wallet',
  getKitStore: vi.fn(),
}

const mockConfig = {
  connectors: [mockConnector],
}

vi.mock('wagmi', () => ({
  useConfig: () => mockConfig,
}))

function createMockAuthConfig(overrides?: Partial<AuthConfig>): AuthConfig {
  return {
    magicLinkBaseUrl: 'https://example.com',
    enabledMethods: ['email'],
    ...overrides,
  }
}

beforeEach(() => {
  mockSendOtp.mockReset()
  mockIsPending = false
  mockError = null
  mockConnector.getKitStore.mockReset()
  mockConfig.connectors = [mockConnector]
})

afterEach(() => {
  cleanup()
})

describe('useSendMagicLink', () => {
  it('sends an OTP with a magicLinkTemplate built from magicLinkBaseUrl', async () => {
    const store = createStore()
    store.getState().auth.initialize(createMockAuthConfig())
    mockConnector.getKitStore.mockReturnValue(store)
    mockSendOtp.mockResolvedValue({ otpId: 'otp-123' })

    const { result } = renderHook(() => useSendMagicLink())

    await act(async () => {
      await result.current.sendMagicLink({ email: 'user@example.com' })
    })

    expect(mockSendOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      emailCustomization: {
        magicLinkTemplate:
          'https://example.com/auth/verify-email?otp=%s&otpSource=email',
      },
    })
  })

  it('stores the returned otpId in the auth store', async () => {
    const store = createStore()
    store.getState().auth.initialize(createMockAuthConfig())
    mockConnector.getKitStore.mockReturnValue(store)
    mockSendOtp.mockResolvedValue({ otpId: 'otp-abc' })

    const { result } = renderHook(() => useSendMagicLink())

    await act(async () => {
      await result.current.sendMagicLink({ email: 'user@example.com' })
    })

    expect(store.getState().auth.otpId).toBe('otp-abc')
  })

  it('returns the otpId from sendMagicLink', async () => {
    const store = createStore()
    store.getState().auth.initialize(createMockAuthConfig())
    mockConnector.getKitStore.mockReturnValue(store)
    mockSendOtp.mockResolvedValue({ otpId: 'otp-xyz' })

    const { result } = renderHook(() => useSendMagicLink())

    let returned: { otpId: string } | undefined
    await act(async () => {
      returned = await result.current.sendMagicLink({
        email: 'user@example.com',
      })
    })

    expect(returned).toEqual({ otpId: 'otp-xyz' })
  })

  it('omits emailCustomization when magicLinkBaseUrl is not set', async () => {
    const store = createStore()
    // no initialize → authConfig is null
    mockConnector.getKitStore.mockReturnValue(store)
    mockSendOtp.mockResolvedValue({ otpId: 'otp-1' })

    const { result } = renderHook(() => useSendMagicLink())

    await act(async () => {
      await result.current.sendMagicLink({ email: 'user@example.com' })
    })

    expect(mockSendOtp).toHaveBeenCalledWith({ email: 'user@example.com' })
  })

  it('propagates errors from sendOtp and does not set otpId', async () => {
    const store = createStore()
    store.getState().auth.initialize(createMockAuthConfig())
    mockConnector.getKitStore.mockReturnValue(store)
    const boom = new Error('network down')
    mockSendOtp.mockRejectedValue(boom)

    const { result } = renderHook(() => useSendMagicLink())

    await expect(
      act(async () => {
        await result.current.sendMagicLink({ email: 'user@example.com' })
      }),
    ).rejects.toThrow('network down')

    expect(store.getState().auth.otpId).toBeNull()
  })

  it('exposes isPending and error from useSendOTP', () => {
    const store = createStore()
    store.getState().auth.initialize(createMockAuthConfig())
    mockConnector.getKitStore.mockReturnValue(store)

    mockIsPending = true
    mockError = new Error('bad')

    const { result } = renderHook(() => useSendMagicLink())

    expect(result.current.isPending).toBe(true)
    expect(result.current.error).toEqual(new Error('bad'))
  })

  it('uses a custom magicLinkBaseUrl from authConfig', async () => {
    const store = createStore()
    store
      .getState()
      .auth.initialize(
        createMockAuthConfig({ magicLinkBaseUrl: 'https://my.app' }),
      )
    mockConnector.getKitStore.mockReturnValue(store)
    mockSendOtp.mockResolvedValue({ otpId: 'otp-1' })

    const { result } = renderHook(() => useSendMagicLink())

    await act(async () => {
      await result.current.sendMagicLink({ email: 'user@example.com' })
    })

    expect(mockSendOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      emailCustomization: {
        magicLinkTemplate:
          'https://my.app/auth/verify-email?otp=%s&otpSource=email',
      },
    })
  })
})
