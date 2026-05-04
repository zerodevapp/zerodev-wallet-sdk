import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSessionIdWeb } from './getSessionIdWeb.js'

const EXPECTED_ORIGIN = 'https://app.example.com'

describe('getSessionIdWeb', () => {
  const originalOpen = window.open

  let currentHref: string | null
  let closedFlag: boolean
  let closeSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    currentHref = null
    closedFlag = false
    closeSpy = vi.fn(() => {
      closedFlag = true
    })

    const mockPopup = {
      location: {
        get href() {
          if (currentHref === null) {
            throw new DOMException('cross-origin read', 'SecurityError')
          }
          return currentHref
        },
        set href(_value: string) {
          // Navigating the popup from the opener: browsers silently navigate;
          // we control what the getter returns separately via `currentHref`.
        },
      },
      get closed() {
        return closedFlag
      },
      close: closeSpy,
    } as unknown as Window

    window.open = vi.fn().mockReturnValue(mockPopup)
  })

  afterEach(() => {
    vi.useRealTimers()
    window.open = originalOpen
  })

  it('resolves with session_id when popup lands on same-origin oauth_success URL', async () => {
    const promise = getSessionIdWeb(
      'https://oauth.example.com',
      EXPECTED_ORIGIN,
    )
    const assertion = expect(promise).resolves.toBe('sid-123')
    // While popup is on provider (cross-origin), polling ignores throws
    await vi.advanceTimersByTimeAsync(500)
    // Flip to same-origin success URL
    currentHref = `${EXPECTED_ORIGIN}/?oauth_success=true&session_id=sid-123`
    await vi.advanceTimersByTimeAsync(250)
    await assertion
    expect(closeSpy).toHaveBeenCalled()
  })

  it('rejects with error param value when popup lands on ?error=access_denied', async () => {
    const promise = getSessionIdWeb(
      'https://oauth.example.com',
      EXPECTED_ORIGIN,
    )
    const assertion = expect(promise).rejects.toThrow('access_denied')
    await vi.advanceTimersByTimeAsync(500)
    currentHref = `${EXPECTED_ORIGIN}/?error=access_denied`
    await vi.advanceTimersByTimeAsync(250)
    await assertion
    expect(closeSpy).toHaveBeenCalled()
  })

  it('rejects when user closes the popup before any valid URL is observed', async () => {
    const promise = getSessionIdWeb(
      'https://oauth.example.com',
      EXPECTED_ORIGIN,
    )
    const assertion = expect(promise).rejects.toThrow('OAuth popup was closed')
    await vi.advanceTimersByTimeAsync(500)
    // Simulate user closing the popup externally (not via our close())
    closedFlag = true
    await vi.advanceTimersByTimeAsync(250)
    await assertion
  })

  it('rejects and closes the popup when OAuth times out', async () => {
    const promise = getSessionIdWeb(
      'https://oauth.example.com',
      EXPECTED_ORIGIN,
      1_000,
    )
    const assertion = expect(promise).rejects.toThrow(
      'OAuth timed out after 1000ms',
    )

    await vi.advanceTimersByTimeAsync(1_001)

    await assertion
    expect(closeSpy).toHaveBeenCalledTimes(1)

    // Polling must stop after timeout — popup must not be closed again
    await vi.advanceTimersByTimeAsync(500)
    expect(closeSpy).toHaveBeenCalledTimes(1)
  })

  it('resolves when the popup self-closes between polls but the success URL is still readable', async () => {
    // Real-world trigger: the OAuth callback page calls window.close() between
    // poll ticks. Chromium preserves popup.location.href across close, so a
    // single tick can observe closed=true together with the success URL.
    // Our own popup.close() can't cause this — clearInterval runs first.
    const promise = getSessionIdWeb(
      'https://oauth.example.com',
      EXPECTED_ORIGIN,
    )
    const result = promise.then(
      (sessionId) => ({ sessionId }),
      (error: Error) => ({ error }),
    )
    await vi.advanceTimersByTimeAsync(500)
    currentHref = `${EXPECTED_ORIGIN}/?oauth_success=true&session_id=sid-123`
    closedFlag = true
    await vi.advanceTimersByTimeAsync(250)
    await expect(result).resolves.toEqual({ sessionId: 'sid-123' })
  })

  it('rejects with missing-session-id message when oauth_success=true lacks session_id', async () => {
    const promise = getSessionIdWeb(
      'https://oauth.example.com',
      EXPECTED_ORIGIN,
    )
    const assertion = expect(promise).rejects.toThrow(
      'OAuth redirect missing session_id',
    )
    await vi.advanceTimersByTimeAsync(500)
    currentHref = `${EXPECTED_ORIGIN}/?oauth_success=true`
    await vi.advanceTimersByTimeAsync(250)
    await assertion
    expect(closeSpy).toHaveBeenCalled()
  })

  it('throws when window.open returns null (popup blocked)', async () => {
    vi.mocked(window.open).mockReturnValue(null)
    await expect(
      getSessionIdWeb('https://oauth.example.com', EXPECTED_ORIGIN),
    ).rejects.toThrow('Failed to open OAuth login window')
  })
})
