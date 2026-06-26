import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiKeyStamper, PasskeyStamper } from '../../stampers/types.js'
import { rest } from './rest.js'

function makeStamper(headerName: string) {
  const stamp = vi.fn(async (payload: string) => ({
    stampHeaderName: headerName,
    // Echo the signed payload back so tests can assert what was signed.
    stampHeaderValue: `signed:${payload}`,
  }))
  return { stamp } as unknown as ApiKeyStamper & { stamp: typeof stamp }
}

describe('rest transport — timestamp stamp position (GET behind StampCheckUser)', () => {
  const apiKeyStamper = makeStamper('X-Stamp')
  const passkeyStamper = makeStamper('X-Stamp-Webauthn')
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ ok: true }),
      text: async () => '{"ok":true}',
    }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('signs the unix-millis string, sends X-Timestamp + stamp header, and no body', async () => {
    const transport = rest('https://kms.test/api/v1', {
      apiKeyStamper,
      passkeyStamper,
    })

    await transport.request({
      path: 'proj-456/user-wallet',
      method: 'GET',
      headers: { Authorization: 'Bearer jwt-token' },
      stamp: true,
      stampPostion: 'timestamp',
    })

    // The stamper signed exactly the X-Timestamp value (the raw millis string),
    // matching the backend's FormatTimestamp(t) = strconv.FormatInt(UnixMilli, 10).
    expect(apiKeyStamper.stamp).toHaveBeenCalledTimes(1)
    const signedPayload = apiKeyStamper.stamp.mock.calls[0]![0] as string
    expect(signedPayload).toMatch(/^\d+$/)

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://kms.test/api/v1/proj-456/user-wallet')
    expect(init.method).toBe('GET')
    // GET has no request body.
    expect(init.body).toBeNull()

    const headers = init.headers as Record<string, string>
    expect(headers['X-Timestamp']).toBe(signedPayload)
    expect(headers['X-Stamp']).toBe(`signed:${signedPayload}`)
    expect(headers.Authorization).toBe('Bearer jwt-token')
  })

  it('uses the passkey stamper when stampWith is passkey', async () => {
    const transport = rest('https://kms.test/api/v1', {
      apiKeyStamper,
      passkeyStamper,
    })

    await transport.request({
      path: 'proj-456/authenticators',
      method: 'GET',
      stamp: true,
      stampWith: 'passkey',
      stampPostion: 'timestamp',
    })

    expect(passkeyStamper.stamp).toHaveBeenCalledTimes(1)
    expect(apiKeyStamper.stamp).not.toHaveBeenCalled()
    const [, init] = fetchMock.mock.calls[0]!
    const headers = init.headers as Record<string, string>
    const ts = headers['X-Timestamp']!
    expect(headers['X-Stamp-Webauthn']).toBe(`signed:${ts}`)
  })
})
