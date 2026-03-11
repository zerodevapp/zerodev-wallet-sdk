import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildBackendOAuthUrl,
  generateOAuthNonce,
  handleOAuthCallback,
  listenForOAuthMessage,
  OAUTH_PROVIDERS,
  openOAuthPopup,
} from './oauth.js'

describe('OAuth utilities', () => {
  describe('OAUTH_PROVIDERS', () => {
    it('has google provider', () => {
      expect(OAUTH_PROVIDERS.GOOGLE).toBe('google')
    })
  })

  describe('generateOAuthNonce', () => {
    it('generates consistent nonce from public key', () => {
      const publicKey = '0x1234567890abcdef'

      const nonce1 = generateOAuthNonce(publicKey)
      const nonce2 = generateOAuthNonce(publicKey)

      expect(nonce1).toBe(nonce2)
    })

    it('returns nonce without 0x prefix', () => {
      const publicKey =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

      const nonce = generateOAuthNonce(publicKey)

      expect(nonce).not.toMatch(/^0x/)
    })

    it('generates different nonces for different keys', () => {
      const key1 =
        '0x1111111111111111111111111111111111111111111111111111111111111111'
      const key2 =
        '0x2222222222222222222222222222222222222222222222222222222222222222'

      const nonce1 = generateOAuthNonce(key1)
      const nonce2 = generateOAuthNonce(key2)

      expect(nonce1).not.toBe(nonce2)
    })
  })

  describe('buildBackendOAuthUrl', () => {
    it('builds correct URL for Google OAuth', () => {
      const url = buildBackendOAuthUrl({
        provider: 'google',
        backendUrl: 'https://api.example.com',
        projectId: 'proj-123',
        publicKey: '0xabcdef1234567890',
        returnTo: 'https://app.example.com/callback',
      })

      const parsedUrl = new URL(url)
      expect(parsedUrl.origin).toBe('https://api.example.com')
      expect(parsedUrl.pathname).toBe('/oauth/google/login')
      expect(parsedUrl.searchParams.get('project_id')).toBe('proj-123')
      expect(parsedUrl.searchParams.get('pub_key')).toBe('abcdef1234567890') // 0x stripped
      expect(parsedUrl.searchParams.get('return_to')).toBe(
        'https://app.example.com/callback',
      )
    })

    it('strips 0x prefix from public key', () => {
      const url = buildBackendOAuthUrl({
        provider: 'google',
        backendUrl: 'https://api.example.com',
        projectId: 'proj-123',
        publicKey: '0x0123456789',
        returnTo: 'https://app.example.com',
      })

      const parsedUrl = new URL(url)
      expect(parsedUrl.searchParams.get('pub_key')).toBe('0123456789')
    })

    it('handles public key without 0x prefix', () => {
      const url = buildBackendOAuthUrl({
        provider: 'google',
        backendUrl: 'https://api.example.com',
        projectId: 'proj-123',
        publicKey: 'abcdef123456',
        returnTo: 'https://app.example.com',
      })

      const parsedUrl = new URL(url)
      expect(parsedUrl.searchParams.get('pub_key')).toBe('abcdef123456')
    })

    it('throws on unsupported provider', () => {
      expect(() =>
        buildBackendOAuthUrl({
          provider: 'facebook' as 'google',
          backendUrl: 'https://api.example.com',
          projectId: 'proj-123',
          publicKey: '0xabcdef',
          returnTo: 'https://app.example.com',
        }),
      ).toThrow('Unsupported OAuth provider: facebook')
    })

    it('encodes special characters in return URL', () => {
      const url = buildBackendOAuthUrl({
        provider: 'google',
        backendUrl: 'https://api.example.com',
        projectId: 'proj-123',
        publicKey: '0xabcdef',
        returnTo: 'https://app.example.com?foo=bar&baz=qux',
      })

      const parsedUrl = new URL(url)
      expect(parsedUrl.searchParams.get('return_to')).toBe(
        'https://app.example.com?foo=bar&baz=qux',
      )
    })
  })

  describe('openOAuthPopup', () => {
    const originalOpen = window.open

    beforeEach(() => {
      window.open = vi.fn()
    })

    afterEach(() => {
      window.open = originalOpen
    })

    it('opens a popup with about:blank initially', () => {
      const mockWindow = { location: { href: '' } }
      vi.mocked(window.open).mockReturnValue(mockWindow as Window)

      openOAuthPopup('https://oauth.example.com')

      expect(window.open).toHaveBeenCalledWith(
        'about:blank',
        '_blank',
        expect.stringContaining('width=500,height=600'),
      )
    })

    it('sets the URL after opening', () => {
      const mockWindow = { location: { href: '' } }
      vi.mocked(window.open).mockReturnValue(mockWindow as Window)

      openOAuthPopup('https://oauth.example.com/login')

      expect(mockWindow.location.href).toBe('https://oauth.example.com/login')
    })

    it('returns the window object', () => {
      const mockWindow = { location: { href: '' } }
      vi.mocked(window.open).mockReturnValue(mockWindow as Window)

      const result = openOAuthPopup('https://oauth.example.com')

      expect(result).toBe(mockWindow)
    })

    it('returns null if popup was blocked', () => {
      vi.mocked(window.open).mockReturnValue(null)

      const result = openOAuthPopup('https://oauth.example.com')

      expect(result).toBeNull()
    })
  })

  describe('listenForOAuthMessage', () => {
    let mockWindow: { closed: boolean }
    let onSuccessMock: ReturnType<typeof vi.fn>
    let onErrorMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      vi.useFakeTimers()
      mockWindow = { closed: false }
      onSuccessMock = vi.fn()
      onErrorMock = vi.fn()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('calls onSuccess with sessionId when oauth_success message received', () => {
      const cleanup = listenForOAuthMessage(
        mockWindow as Window,
        'https://app.example.com',
        onSuccessMock as (sessionId: string) => void,
        onErrorMock as (error: Error) => void,
      )

      // Simulate receiving a message with sessionId
      const event = new MessageEvent('message', {
        data: { type: 'oauth_success', sessionId: 'test-session-123' },
        origin: 'https://app.example.com',
      })
      window.dispatchEvent(event)

      expect(onSuccessMock).toHaveBeenCalledOnce()
      expect(onSuccessMock).toHaveBeenCalledWith('test-session-123')
      expect(onErrorMock).not.toHaveBeenCalled()
      cleanup()
    })

    it('calls onSuccess with empty string when sessionId is missing', () => {
      const cleanup = listenForOAuthMessage(
        mockWindow as Window,
        'https://app.example.com',
        onSuccessMock as (sessionId: string) => void,
        onErrorMock as (error: Error) => void,
      )

      const event = new MessageEvent('message', {
        data: { type: 'oauth_success' },
        origin: 'https://app.example.com',
      })
      window.dispatchEvent(event)

      expect(onSuccessMock).toHaveBeenCalledOnce()
      expect(onSuccessMock).toHaveBeenCalledWith('')
      expect(onErrorMock).not.toHaveBeenCalled()
      cleanup()
    })

    it('calls onError when oauth_error message received', () => {
      const cleanup = listenForOAuthMessage(
        mockWindow as Window,
        'https://app.example.com',
        onSuccessMock as (sessionId: string) => void,
        onErrorMock as (error: Error) => void,
      )

      const event = new MessageEvent('message', {
        data: { type: 'oauth_error', error: 'Access denied' },
        origin: 'https://app.example.com',
      })
      window.dispatchEvent(event)

      expect(onErrorMock).toHaveBeenCalledOnce()
      expect(onErrorMock).toHaveBeenCalledWith(new Error('Access denied'))
      expect(onSuccessMock).not.toHaveBeenCalled()
      cleanup()
    })

    it('ignores messages from wrong origin', () => {
      const cleanup = listenForOAuthMessage(
        mockWindow as Window,
        'https://app.example.com',
        onSuccessMock as (sessionId: string) => void,
        onErrorMock as (error: Error) => void,
      )

      const event = new MessageEvent('message', {
        data: { type: 'oauth_success' },
        origin: 'https://malicious.example.com',
      })
      window.dispatchEvent(event)

      expect(onSuccessMock).not.toHaveBeenCalled()
      expect(onErrorMock).not.toHaveBeenCalled()
      cleanup()
    })

    it('calls onError when window is closed', () => {
      const cleanup = listenForOAuthMessage(
        mockWindow as Window,
        'https://app.example.com',
        onSuccessMock as (sessionId: string) => void,
        onErrorMock as (error: Error) => void,
      )

      mockWindow.closed = true
      vi.advanceTimersByTime(600)

      expect(onErrorMock).toHaveBeenCalledWith(
        new Error('Authentication window was closed'),
      )
      cleanup()
    })

    it('uses fallback error message when oauth_error has no error field', () => {
      const cleanup = listenForOAuthMessage(
        mockWindow as Window,
        'https://app.example.com',
        onSuccessMock as (sessionId: string) => void,
        onErrorMock as (error: Error) => void,
      )

      const event = new MessageEvent('message', {
        data: { type: 'oauth_error' },
        origin: 'https://app.example.com',
      })
      window.dispatchEvent(event)

      expect(onErrorMock).toHaveBeenCalledWith(
        new Error('OAuth authentication failed'),
      )
      cleanup()
    })

    it('ignores messages with non-object data', () => {
      const cleanup = listenForOAuthMessage(
        mockWindow as Window,
        'https://app.example.com',
        onSuccessMock as (sessionId: string) => void,
        onErrorMock as (error: Error) => void,
      )

      // null data
      window.dispatchEvent(
        new MessageEvent('message', {
          data: null,
          origin: 'https://app.example.com',
        }),
      )
      // string data
      window.dispatchEvent(
        new MessageEvent('message', {
          data: 'some-string',
          origin: 'https://app.example.com',
        }),
      )
      // number data
      window.dispatchEvent(
        new MessageEvent('message', {
          data: 42,
          origin: 'https://app.example.com',
        }),
      )

      expect(onSuccessMock).not.toHaveBeenCalled()
      expect(onErrorMock).not.toHaveBeenCalled()
      cleanup()
    })

    it('calling cleanup multiple times is safe', () => {
      const cleanup = listenForOAuthMessage(
        mockWindow as Window,
        'https://app.example.com',
        onSuccessMock as (sessionId: string) => void,
        onErrorMock as (error: Error) => void,
      )

      cleanup()
      cleanup()
      cleanup()

      // Should not throw and subsequent messages should be ignored
      const event = new MessageEvent('message', {
        data: { type: 'oauth_success' },
        origin: 'https://app.example.com',
      })
      window.dispatchEvent(event)

      expect(onSuccessMock).not.toHaveBeenCalled()
    })

    it('returns cleanup function that stops listening', () => {
      const cleanup = listenForOAuthMessage(
        mockWindow as Window,
        'https://app.example.com',
        onSuccessMock as (sessionId: string) => void,
        onErrorMock as (error: Error) => void,
      )

      cleanup()

      // Message after cleanup should be ignored
      const event = new MessageEvent('message', {
        data: { type: 'oauth_success' },
        origin: 'https://app.example.com',
      })
      window.dispatchEvent(event)

      expect(onSuccessMock).not.toHaveBeenCalled()
    })
  })

  describe('handleOAuthCallback', () => {
    const originalLocation = window.location
    const originalOpener = window.opener
    const originalClose = window.close

    beforeEach(() => {
      // @ts-expect-error - Mocking location
      delete window.location
      // @ts-expect-error - Mocking location with partial properties
      window.location = {
        ...originalLocation,
        search: '',
        origin: 'https://app.example.com',
      } as Location

      window.opener = {
        postMessage: vi.fn(),
      } as unknown as Window

      window.close = vi.fn()
    })

    afterEach(() => {
      // @ts-expect-error - Restoring original location
      window.location = originalLocation
      window.opener = originalOpener
      window.close = originalClose
    })

    it('returns true and posts success message with sessionId on oauth_success=true', () => {
      window.location.search = '?oauth_success=true&session_id=abc123'

      const result = handleOAuthCallback()

      expect(result).toBe(true)
      expect(window.opener?.postMessage).toHaveBeenCalledWith(
        { type: 'oauth_success', sessionId: 'abc123' },
        'https://app.example.com',
      )
      expect(window.close).toHaveBeenCalled()
    })

    it('posts success message without sessionId when session_id param is missing', () => {
      window.location.search = '?oauth_success=true'

      const result = handleOAuthCallback()

      expect(result).toBe(true)
      expect(window.opener?.postMessage).toHaveBeenCalledWith(
        { type: 'oauth_success' },
        'https://app.example.com',
      )
      expect(window.close).toHaveBeenCalled()
    })

    it('returns false and posts error message on error param', () => {
      window.location.search = '?error=access_denied'

      const result = handleOAuthCallback()

      expect(result).toBe(false)
      expect(window.opener?.postMessage).toHaveBeenCalledWith(
        { type: 'oauth_error', error: 'access_denied' },
        'https://app.example.com',
      )
      expect(window.close).toHaveBeenCalled()
    })

    it('supports custom success param name', () => {
      window.location.search = '?custom_param=true'

      const result = handleOAuthCallback('custom_param')

      expect(result).toBe(true)
    })

    it('returns false when no opener', () => {
      window.opener = null
      window.location.search = '?oauth_success=true'

      const result = handleOAuthCallback()

      expect(result).toBe(false)
    })

    it('returns false when no relevant params', () => {
      window.location.search = '?some_other_param=value'

      const result = handleOAuthCallback()

      expect(result).toBe(false)
    })
  })
})
