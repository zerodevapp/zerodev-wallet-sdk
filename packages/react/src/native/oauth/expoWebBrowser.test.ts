import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  listener: undefined as ((event: { url: string }) => void) | undefined,
  remove: vi.fn(),
  openAuthSessionAsync: vi.fn(),
  dismissBrowser: vi.fn(),
}))

vi.mock('expo-linking', () => ({
  addEventListener: vi.fn(
    (_type: string, listener: (event: { url: string }) => void) => {
      h.listener = listener
      return { remove: h.remove }
    },
  ),
}))

vi.mock('expo-web-browser', () => ({
  openAuthSessionAsync: h.openAuthSessionAsync,
  dismissBrowser: h.dismissBrowser,
}))

import { createOAuthGetSessionIdWithExpoWebBrowser } from './expoWebBrowser.js'

beforeEach(() => {
  vi.clearAllMocks()
  h.listener = undefined
  h.dismissBrowser.mockResolvedValue(undefined)
})

describe('createOAuthGetSessionIdWithExpoWebBrowser', () => {
  it('ignores unrelated deep links and accepts the exact configured callback', async () => {
    let finishBrowser!: (result: { type: string; url: string }) => void
    h.openAuthSessionAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        finishBrowser = resolve
      }),
    )
    const getSessionId = createOAuthGetSessionIdWithExpoWebBrowser({
      redirectUri: 'myapp://oauth/callback',
    })
    const result = getSessionId({
      oauthUrl: 'https://accounts.google.com/oauth',
      provider: 'google',
    })
    h.listener?.({
      url: 'myapp://other/callback?oauth_success=true&session_id=attacker',
    })
    finishBrowser({
      type: 'success',
      url: 'myapp://oauth/callback?oauth_success=true&session_id=valid',
    })

    await expect(result).resolves.toBe('valid')
    expect(h.remove).toHaveBeenCalledOnce()
  })

  it('rejects a browser result from a different callback URL', async () => {
    h.openAuthSessionAsync.mockResolvedValueOnce({
      type: 'success',
      url: 'myapp://other/callback?oauth_success=true&session_id=attacker',
    })
    const getSessionId = createOAuthGetSessionIdWithExpoWebBrowser({
      redirectUri: 'myapp://oauth/callback',
    })

    await expect(
      getSessionId({
        oauthUrl: 'https://accounts.google.com/oauth',
        provider: 'google',
      }),
    ).rejects.toThrow(/did not match/)
  })
})
