import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStore } from '../../store'
import type { AuthConfig } from '../types'
import { useAuth } from './useAuth'

// Mock wagmi
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

afterEach(() => {
  cleanup()
  mockConnector.getKitStore.mockClear()
  mockConfig.connectors = [mockConnector]
})

function createMockAuthConfig(overrides?: Partial<AuthConfig>): AuthConfig {
  return {
    magicLinkBaseUrl: 'https://example.com/auth/verify',
    enabledMethods: ['email', 'google', 'passkey'],
    onSuccess: () => {},
    onError: () => {},
    ...overrides,
  }
}

describe('useAuth', () => {
  it('throws error when zerodev-wallet connector is not found', () => {
    mockConfig.connectors = []

    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used with zeroDevWallet connector',
    )

    // Restore
    mockConfig.connectors = [mockConnector]
  })

  it('throws error when connector does not have getKitStore method', () => {
    const badConnector = { id: 'zerodev-wallet' }
    mockConfig.connectors = [badConnector as any]

    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used with zeroDevWallet connector',
    )

    // Restore
    mockConfig.connectors = [mockConnector]
  })

  it('returns initial auth state', () => {
    const store = createStore()
    mockConnector.getKitStore.mockReturnValue(store)

    const { result } = renderHook(() => useAuth())

    expect(result.current.step).toBe('initializing')
    expect(result.current.email).toBeNull()
    expect(result.current.otpId).toBeNull()
    expect(result.current.enabledMethods).toEqual([])
    expect(result.current.config).toBeNull()
  })

  it('returns auth state after initialization', () => {
    const store = createStore()
    const config = createMockAuthConfig()
    store.getState().auth.initialize(config)
    mockConnector.getKitStore.mockReturnValue(store)

    const { result } = renderHook(() => useAuth())

    expect(result.current.step).toBe('initializing')
    expect(result.current.enabledMethods).toEqual([
      'email',
      'google',
      'passkey',
    ])
    expect(result.current.config).toEqual(config)
  })

  it('returns email, otpId, and otpEncryptionTargetBundle from store', () => {
    const store = createStore()
    store.getState().auth.setEmail('user@example.com')
    store.getState().auth.setOtpSession({
      otpId: 'otp-123',
      otpEncryptionTargetBundle: 'bundle-xyz',
    })
    mockConnector.getKitStore.mockReturnValue(store)

    const { result } = renderHook(() => useAuth())

    expect(result.current.email).toBe('user@example.com')
    expect(result.current.otpId).toBe('otp-123')
    expect(result.current.otpEncryptionTargetBundle).toBe('bundle-xyz')
  })

  it('exposes goToStep function', () => {
    const store = createStore()
    const config = createMockAuthConfig()
    store.getState().auth.initialize(config)
    mockConnector.getKitStore.mockReturnValue(store)

    const { result } = renderHook(() => useAuth())

    result.current.goToStep('email-verification')

    expect(store.getState().auth.step).toBe('email-verification')
  })

  it('exposes onBack function when history is non-empty', () => {
    const store = createStore()
    const config = createMockAuthConfig()
    store.getState().auth.initialize(config)
    store.getState().auth.goToStep('email-verification')
    store.getState().auth.goToStep('otp-input')
    mockConnector.getKitStore.mockReturnValue(store)

    const { result } = renderHook(() => useAuth())

    expect(result.current.onBack).not.toBeNull()
    result.current.onBack?.()

    expect(store.getState().auth.step).toBe('email-verification')
  })

  it('returns onBack as null when history is empty', () => {
    const store = createStore()
    const config = createMockAuthConfig()
    store.getState().auth.initialize(config)
    store.getState().auth.goToStep('sign-up')
    mockConnector.getKitStore.mockReturnValue(store)

    const { result } = renderHook(() => useAuth())

    expect(result.current.onBack).toBeNull()
  })

  it('exposes reset function', () => {
    const store = createStore()
    const config = createMockAuthConfig()
    store.getState().auth.initialize(config)
    store.getState().auth.setEmail('user@example.com')
    store.getState().auth.goToStep('email-verification')
    mockConnector.getKitStore.mockReturnValue(store)

    const { result } = renderHook(() => useAuth())

    result.current.reset()

    const { auth } = store.getState()
    expect(auth.step).toBe('initializing')
    expect(auth.email).toBeNull()
  })

  it('exposes setEmail function', () => {
    const store = createStore()
    mockConnector.getKitStore.mockReturnValue(store)

    const { result } = renderHook(() => useAuth())

    result.current.setEmail('new@example.com')

    expect(store.getState().auth.email).toBe('new@example.com')
  })

  it('exposes setOtpSession function', () => {
    const store = createStore()
    mockConnector.getKitStore.mockReturnValue(store)

    const { result } = renderHook(() => useAuth())

    result.current.setOtpSession({
      otpId: 'otp-456',
      otpEncryptionTargetBundle: 'bundle-456',
    })

    expect(store.getState().auth.otpId).toBe('otp-456')
    expect(store.getState().auth.otpEncryptionTargetBundle).toBe('bundle-456')
  })

  it('reactively updates when store changes', () => {
    const store = createStore()
    const config = createMockAuthConfig()
    mockConnector.getKitStore.mockReturnValue(store)

    const { result, rerender } = renderHook(() => useAuth())

    expect(result.current.step).toBe('initializing')

    // Change store state
    store.getState().auth.initialize(config)
    store.getState().auth.goToStep('sign-up')
    rerender()

    expect(result.current.step).toBe('sign-up')
  })

  it('handles multiple step transitions', () => {
    const store = createStore()
    const config = createMockAuthConfig()
    store.getState().auth.initialize(config)
    store.getState().auth.goToStep('sign-up')
    mockConnector.getKitStore.mockReturnValue(store)

    const { result, rerender } = renderHook(() => useAuth())

    expect(result.current.step).toBe('sign-up')

    result.current.goToStep('email-verification')
    rerender()
    expect(result.current.step).toBe('email-verification')

    result.current.goToStep('otp-input')
    rerender()
    expect(result.current.step).toBe('otp-input')

    result.current.goToStep('verifying-otp')
    rerender()
    expect(result.current.step).toBe('verifying-otp')

    result.current.goToStep('authenticated')
    rerender()
    expect(result.current.step).toBe('authenticated')
  })

  it('handles complete email auth flow', () => {
    const store = createStore()
    const config = createMockAuthConfig()
    store.getState().auth.initialize(config)
    mockConnector.getKitStore.mockReturnValue(store)

    const { result, rerender } = renderHook(() => useAuth())

    result.current.goToStep('sign-up')
    rerender()

    // Enter email
    result.current.setEmail('user@example.com')
    result.current.goToStep('email-verification')
    rerender()
    expect(result.current.email).toBe('user@example.com')
    expect(result.current.step).toBe('email-verification')

    // Set OTP session
    result.current.setOtpSession({
      otpId: 'otp-123',
      otpEncryptionTargetBundle: 'bundle-123',
    })
    result.current.goToStep('otp-input')
    rerender()
    expect(result.current.otpId).toBe('otp-123')
    expect(result.current.otpEncryptionTargetBundle).toBe('bundle-123')
    expect(result.current.step).toBe('otp-input')

    // Verify
    result.current.goToStep('verifying-otp')
    rerender()
    expect(result.current.step).toBe('verifying-otp')

    // Success
    result.current.goToStep('authenticated')
    rerender()
    expect(result.current.step).toBe('authenticated')
  })

  it('works with different enabled methods', () => {
    const store = createStore()
    const config = createMockAuthConfig({
      enabledMethods: ['passkey', 'injected-wallet'],
    })
    store.getState().auth.initialize(config)
    mockConnector.getKitStore.mockReturnValue(store)

    const { result } = renderHook(() => useAuth())

    expect(result.current.enabledMethods).toEqual([
      'passkey',
      'injected-wallet',
    ])
  })
})
