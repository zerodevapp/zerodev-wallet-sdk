import { describe, expect, it, vi } from 'vitest'
import { createStore } from '../store'
import type { AuthConfig } from './types'

function createMockAuthConfig(overrides?: Partial<AuthConfig>): AuthConfig {
  return {
    magicLinkBaseUrl: 'https://example.com/auth/verify',
    enabledMethods: ['email', 'google', 'passkey'],
    onSuccess: () => {},
    onError: () => {},
    ...overrides,
  }
}

describe('authStoreSlice', () => {
  describe('initial state', () => {
    it('has correct initial state', () => {
      const store = createStore()
      const { auth } = store.getState()

      expect(auth.step).toBe('initializing')
      expect(auth.stepHistory).toEqual([])
      expect(auth.enabledMethods).toEqual([])
      expect(auth.email).toBeNull()
      expect(auth.otpId).toBeNull()
      expect(auth.config).toBeNull()
    })
  })

  describe('initialize', () => {
    it('sets config and enabled methods', () => {
      const store = createStore()
      const config = createMockAuthConfig()

      store.getState().auth.initialize(config)

      const { auth } = store.getState()
      expect(auth.config).toEqual(config)
      expect(auth.enabledMethods).toEqual(['email', 'google', 'passkey'])
      expect(auth.step).toBe('initializing')
    })

    it('sets custom enabled methods from config', () => {
      const store = createStore()
      const config = createMockAuthConfig({
        enabledMethods: ['passkey', 'injected-wallet'],
      })

      store.getState().auth.initialize(config)

      expect(store.getState().auth.enabledMethods).toEqual([
        'passkey',
        'injected-wallet',
      ])
    })
  })

  describe('goToStep', () => {
    it('updates step and adds previous step to history', () => {
      const store = createStore()
      const config = createMockAuthConfig()
      store.getState().auth.initialize(config)
      store.getState().auth.goToStep('sign-up')

      store.getState().auth.goToStep('email-verification')

      const { auth } = store.getState()
      expect(auth.step).toBe('email-verification')
      expect(auth.stepHistory).toEqual(['initializing', 'sign-up'])
    })

    it('builds up step history on multiple transitions', () => {
      const store = createStore()
      const config = createMockAuthConfig()
      store.getState().auth.initialize(config)
      store.getState().auth.goToStep('sign-up')

      store.getState().auth.goToStep('email-verification')
      store.getState().auth.goToStep('otp-input')
      store.getState().auth.goToStep('verifying-otp')

      const { auth } = store.getState()
      expect(auth.step).toBe('verifying-otp')
      expect(auth.stepHistory).toEqual([
        'initializing',
        'sign-up',
        'email-verification',
        'otp-input',
      ])
    })
  })

  describe('goBack', () => {
    it('returns to previous step and removes it from history', () => {
      const store = createStore()
      const config = createMockAuthConfig()
      store.getState().auth.initialize(config)
      store.getState().auth.goToStep('sign-up')

      store.getState().auth.goToStep('email-verification')
      store.getState().auth.goToStep('otp-input')

      store.getState().auth.goBack()

      const { auth } = store.getState()
      expect(auth.step).toBe('email-verification')
      expect(auth.stepHistory).toEqual(['initializing', 'sign-up'])
    })

    it('returns to sign-up when history is empty', () => {
      const store = createStore()
      const config = createMockAuthConfig()
      store.getState().auth.initialize(config)

      store.getState().auth.goBack()

      const { auth } = store.getState()
      expect(auth.step).toBe('sign-up')
      expect(auth.stepHistory).toEqual([])
    })

    it('handles multiple goBack calls', () => {
      const store = createStore()
      const config = createMockAuthConfig()
      store.getState().auth.initialize(config)
      store.getState().auth.goToStep('sign-up')

      store.getState().auth.goToStep('email-verification')
      store.getState().auth.goToStep('otp-input')
      store.getState().auth.goToStep('verifying-otp')

      store.getState().auth.goBack()
      expect(store.getState().auth.step).toBe('otp-input')

      store.getState().auth.goBack()
      expect(store.getState().auth.step).toBe('email-verification')

      store.getState().auth.goBack()
      expect(store.getState().auth.step).toBe('sign-up')
      expect(store.getState().auth.stepHistory).toEqual(['initializing'])
    })
  })

  describe('reset', () => {
    it('resets auth state to initial values', () => {
      const store = createStore()
      const config = createMockAuthConfig()
      store.getState().auth.initialize(config)

      store.getState().auth.setEmail('test@example.com')
      store.getState().auth.setOtpSession({
        otpId: 'otp-123',
        otpEncryptionTargetBundle: 'bundle-123',
      })
      store.getState().auth.goToStep('email-verification')
      store.getState().auth.goToStep('otp-input')

      store.getState().auth.reset()

      const { auth } = store.getState()
      expect(auth.step).toBe('initializing')
      expect(auth.stepHistory).toEqual([])
      expect(auth.email).toBeNull()
      expect(auth.otpId).toBeNull()
      // Config and enabledMethods are preserved
      expect(auth.config).toEqual(config)
      expect(auth.enabledMethods).toEqual(['email', 'google', 'passkey'])
    })
  })

  describe('setEmail', () => {
    it('sets the email', () => {
      const store = createStore()

      store.getState().auth.setEmail('user@example.com')

      expect(store.getState().auth.email).toBe('user@example.com')
    })

    it('updates email value', () => {
      const store = createStore()

      store.getState().auth.setEmail('first@example.com')
      expect(store.getState().auth.email).toBe('first@example.com')

      store.getState().auth.setEmail('second@example.com')
      expect(store.getState().auth.email).toBe('second@example.com')
    })
  })

  describe('setOtpSession', () => {
    it('sets otpId and otpEncryptionTargetBundle together', () => {
      const store = createStore()

      store.getState().auth.setOtpSession({
        otpId: 'otp-abc-123',
        otpEncryptionTargetBundle: 'bundle-abc',
      })

      expect(store.getState().auth.otpId).toBe('otp-abc-123')
      expect(store.getState().auth.otpEncryptionTargetBundle).toBe('bundle-abc')
    })

    it('replaces previous values on subsequent calls', () => {
      const store = createStore()

      store.getState().auth.setOtpSession({
        otpId: 'otp-first',
        otpEncryptionTargetBundle: 'bundle-first',
      })
      expect(store.getState().auth.otpId).toBe('otp-first')
      expect(store.getState().auth.otpEncryptionTargetBundle).toBe(
        'bundle-first',
      )

      store.getState().auth.setOtpSession({
        otpId: 'otp-second',
        otpEncryptionTargetBundle: 'bundle-second',
      })
      expect(store.getState().auth.otpId).toBe('otp-second')
      expect(store.getState().auth.otpEncryptionTargetBundle).toBe(
        'bundle-second',
      )
    })
  })

  describe('integration', () => {
    it('handles a complete email auth flow', () => {
      const store = createStore()
      const config = createMockAuthConfig()

      // Initialize
      store.getState().auth.initialize(config)
      store.getState().auth.goToStep('sign-up')
      expect(store.getState().auth.step).toBe('sign-up')

      // User enters email
      store.getState().auth.setEmail('user@example.com')
      store.getState().auth.goToStep('email-verification')
      expect(store.getState().auth.step).toBe('email-verification')

      // OTP sent
      store.getState().auth.setOtpSession({
        otpId: 'otp-123',
        otpEncryptionTargetBundle: 'bundle-123',
      })
      store.getState().auth.goToStep('otp-input')
      expect(store.getState().auth.step).toBe('otp-input')

      // User enters OTP
      store.getState().auth.goToStep('verifying-otp')
      expect(store.getState().auth.step).toBe('verifying-otp')

      // Success
      store.getState().auth.goToStep('authenticated')

      const { auth } = store.getState()
      expect(auth.step).toBe('authenticated')
      expect(auth.email).toBe('user@example.com')
      expect(auth.otpId).toBe('otp-123')
      expect(auth.stepHistory).toEqual([
        'initializing',
        'sign-up',
        'email-verification',
        'otp-input',
        'verifying-otp',
      ])
    })

    it('handles user going back during flow', () => {
      const store = createStore()
      const config = createMockAuthConfig()

      store.getState().auth.initialize(config)
      store.getState().auth.goToStep('sign-up')
      store.getState().auth.setEmail('user@example.com')
      store.getState().auth.goToStep('email-verification')
      store.getState().auth.setOtpSession({
        otpId: 'otp-123',
        otpEncryptionTargetBundle: 'bundle-123',
      })
      store.getState().auth.goToStep('otp-input')

      // User goes back to change email
      store.getState().auth.goBack()
      expect(store.getState().auth.step).toBe('email-verification')

      store.getState().auth.goBack()
      expect(store.getState().auth.step).toBe('sign-up')

      // Email and otpId are still preserved
      expect(store.getState().auth.email).toBe('user@example.com')
      expect(store.getState().auth.otpId).toBe('otp-123')
    })

    it('handles error and reset flow', () => {
      const store = createStore()
      const config = createMockAuthConfig()

      store.getState().auth.initialize(config)
      store.getState().auth.setEmail('user@example.com')
      store.getState().auth.goToStep('email-verification')
      store.getState().auth.setOtpSession({
        otpId: 'otp-123',
        otpEncryptionTargetBundle: 'bundle-123',
      })
      store.getState().auth.goToStep('otp-input')

      // Error occurs
      store.getState().auth.goToStep('error')
      expect(store.getState().auth.step).toBe('error')

      // User resets
      store.getState().auth.reset()

      const { auth } = store.getState()
      expect(auth.step).toBe('initializing')
      expect(auth.email).toBeNull()
      expect(auth.otpId).toBeNull()
      expect(auth.stepHistory).toEqual([])
    })
  })

  describe('subscriptions', () => {
    it('fires subscription on step change', () => {
      const store = createStore()
      const config = createMockAuthConfig()
      const listener = vi.fn()

      store.subscribe((state) => state.auth.step, listener)

      store.getState().auth.initialize(config)
      expect(listener).not.toHaveBeenCalled()

      store.getState().auth.goToStep('sign-up')
      expect(listener).toHaveBeenCalledWith('sign-up', 'initializing')
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('fires subscription on email change', () => {
      const store = createStore()
      const listener = vi.fn()

      store.subscribe((state) => state.auth.email, listener)

      store.getState().auth.setEmail('test@example.com')
      expect(listener).toHaveBeenCalledWith('test@example.com', null)
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('does not fire subscription when unrelated auth state changes', () => {
      const store = createStore()
      const listener = vi.fn()

      store.subscribe((state) => state.auth.email, listener)

      store.getState().auth.setOtpSession({
        otpId: 'otp-123',
        otpEncryptionTargetBundle: 'bundle-123',
      })
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('independent instances', () => {
    it('each createStore returns independent auth state', () => {
      const store1 = createStore()
      const store2 = createStore()
      const config = createMockAuthConfig()

      store1.getState().auth.initialize(config)
      store1.getState().auth.setEmail('user1@example.com')

      expect(store1.getState().auth.email).toBe('user1@example.com')
      expect(store1.getState().auth.step).toBe('initializing')

      expect(store2.getState().auth.email).toBeNull()
      expect(store2.getState().auth.step).toBe('initializing')
    })
  })
})
