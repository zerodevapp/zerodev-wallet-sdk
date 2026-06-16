import { describe, expect, it, vi } from 'vitest'
import type { Client } from '../../client/types.js'
import { authenticateWithEmail } from './authenticateWithEmail.js'
import { authenticateWithOAuth } from './authenticateWithOAuth.js'
import { getAuthenticators } from './getAuthenticators.js'
import { getOAuthLoginUrl } from './getOAuthLoginUrl.js'
import { getWhoami } from './getWhoami.js'
import { loginWithStamp } from './loginWithStamp.js'
import { registerWithPasskey } from './registerWithPasskey.js'

// Create a mock client with configurable request implementation
function createMockClient(
  requestImpl?: (params: {
    path: string
    method?: string
    body?: unknown
    credentials?: string
    headers?: Record<string, string>
    stamp?: boolean
    stampPostion?: string
  }) => Promise<unknown>,
): Client {
  const mockStamp = {
    stampHeaderName: 'X-Stamp',
    stampHeaderValue: 'mock-stamp-value',
  }

  return {
    transport: {
      name: 'test',
      key: 'test',
      url: 'https://test.example.com',
      timeoutMs: 5000,
      type: 'rest',
    },
    request: vi.fn(
      requestImpl || (async () => ({})),
    ) as unknown as Client['request'],
    apiKeyStamper: {
      stamp: vi.fn().mockResolvedValue(mockStamp),
      init: vi.fn().mockResolvedValue(undefined),
      publicKey: vi.fn().mockReturnValue('mock-public-key'),
      injectCredentialBundle: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    } as unknown as Client['apiKeyStamper'],
    passkeyStamper: {
      stamp: vi.fn().mockResolvedValue(mockStamp),
    } as unknown as Client['passkeyStamper'],
    key: 'test-client',
    name: 'Test Client',
    type: 'zeroDevWalletClient',
    uid: 'test-uid',
    extend: vi.fn() as unknown as Client['extend'],
  }
}

describe('authenticateWithOAuth', () => {
  it('sends OAuth auth request with sessionId and popSignature in body', async () => {
    const mockClient = createMockClient(async () => ({
      userId: 'user-123',
      session: 'session-jwt',
    }))

    const result = await authenticateWithOAuth(mockClient, {
      provider: 'google',
      projectId: 'proj-456',
      sessionId: 'test-session-id',
      popSignature: '3045-der-hex',
    })

    expect(mockClient.request).toHaveBeenCalledWith({
      path: 'proj-456/auth/oauth',
      method: 'POST',
      body: {
        sessionId: 'test-session-id',
        popSignature: '3045-der-hex',
      },
    })
    expect(result).toEqual({
      userId: 'user-123',
      session: 'session-jwt',
    })
  })

  it('returns full OAuth response with all optional fields', async () => {
    const fullResponse = {
      userId: 'user-123',
      walletAddress: '0x1234567890abcdef',
      subOrganizationId: 'suborg-456',
      session: 'session-jwt-token',
    }
    const mockClient = createMockClient(async () => fullResponse)

    const result = await authenticateWithOAuth(mockClient, {
      provider: 'google',
      projectId: 'proj-456',
      sessionId: 'test-session-id',
      popSignature: '3045-der-hex',
    })

    expect(result).toEqual(fullResponse)
  })

  it('handles OAuth failure gracefully', async () => {
    const mockClient = createMockClient(async () => {
      throw new Error('OAuth session expired')
    })

    await expect(
      authenticateWithOAuth(mockClient, {
        provider: 'google',
        projectId: 'proj-456',
        sessionId: 'expired-session',
        popSignature: '3045-der-hex',
      }),
    ).rejects.toThrow('OAuth session expired')
  })
})

describe('authenticateWithEmail', () => {
  it('sends email auth request with correct parameters', async () => {
    const mockClient = createMockClient(async () => ({
      userId: 'user-123',
      requiresMagicLink: true,
    }))

    const result = await authenticateWithEmail(mockClient, {
      email: 'user@example.com',
      projectId: 'proj-456',
      targetPublicKey: '03abcdef1234567890',
    })

    expect(mockClient.request).toHaveBeenCalledWith({
      path: 'proj-456/auth/email-magic',
      method: 'POST',
      body: {
        email: 'user@example.com',
        emailCustomization: undefined,
        targetPublicKey: '03abcdef1234567890',
        projectId: 'proj-456',
      },
    })
    expect(result).toEqual({
      userId: 'user-123',
      requiresMagicLink: true,
    })
  })

  it('includes email customization when provided', async () => {
    const mockClient = createMockClient(async () => ({}))

    await authenticateWithEmail(mockClient, {
      email: 'user@example.com',
      projectId: 'proj-456',
      targetPublicKey: '03abcdef',
      emailCustomization: {
        magicLinkTemplate: 'https://myapp.com/verify/%s',
      },
    })

    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          emailCustomization: {
            magicLinkTemplate: 'https://myapp.com/verify/%s',
          },
        }),
      }),
    )
  })

  it('returns turnkey session when available', async () => {
    const mockClient = createMockClient(async () => ({
      userId: 'user-123',
      turnkeySession: 'turnkey-jwt-token',
      requiresMagicLink: false,
    }))

    const result = await authenticateWithEmail(mockClient, {
      email: 'user@example.com',
      projectId: 'proj-456',
      targetPublicKey: '03abcdef',
    })

    expect(result.turnkeySession).toBe('turnkey-jwt-token')
    expect(result.requiresMagicLink).toBe(false)
  })
})

describe('loginWithStamp', () => {
  it('sends stamp login request with indexedDb stamper by default', async () => {
    const mockClient = createMockClient(async () => ({
      session: 'session-jwt',
    }))

    const result = await loginWithStamp(mockClient, {
      projectId: 'proj-456',
      organizationId: 'org-123',
      targetPublicKey: '03abcdef1234567890',
    })

    // Verify indexedDb stamper was used
    expect(mockClient.apiKeyStamper.stamp).toHaveBeenCalled()
    expect(mockClient.passkeyStamper.stamp).not.toHaveBeenCalled()

    // Verify the stamp payload structure
    const stampCall = vi.mocked(mockClient.apiKeyStamper.stamp).mock.calls[0]
    const stampPayload = JSON.parse(stampCall[0] as string)
    expect(stampPayload).toMatchObject({
      organizationId: 'org-123',
      parameters: {
        publicKey: '03abcdef1234567890',
      },
      type: 'ACTIVITY_TYPE_STAMP_LOGIN',
    })
    expect(stampPayload.timestampMs).toBeDefined()

    // Verify request was made correctly. The sub-org id is NOT sent — the
    // backend derives it from the stamped credential; the org only lives in
    // the signed stampPayload above.
    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'proj-456/auth/login/stamp',
        method: 'POST',
        body: expect.objectContaining({
          targetPublicKey: '03abcdef1234567890',
          stamp: expect.objectContaining({
            stampHeaderName: 'X-Stamp',
            stampHeaderValue: 'mock-stamp-value',
          }),
        }),
      }),
    )
    const sentBody = vi.mocked(mockClient.request).mock.calls[0][0].body
    expect(sentBody).not.toHaveProperty('subOrganizationId')

    expect(result).toEqual({ session: 'session-jwt' })
  })

  it('uses passkey stamper when specified', async () => {
    const mockClient = createMockClient(async () => ({
      session: 'session-jwt',
    }))

    await loginWithStamp(mockClient, {
      projectId: 'proj-456',
      organizationId: 'org-123',
      targetPublicKey: '03abcdef',
      stampWith: 'passkey',
    })

    expect(mockClient.passkeyStamper.stamp).toHaveBeenCalled()
    expect(mockClient.apiKeyStamper.stamp).not.toHaveBeenCalled()
  })

  it('uses apiKey stamper when explicitly specified', async () => {
    const mockClient = createMockClient(async () => ({
      session: 'session-jwt',
    }))

    await loginWithStamp(mockClient, {
      projectId: 'proj-456',
      organizationId: 'org-123',
      targetPublicKey: '03abcdef',
      stampWith: 'apiKey',
    })

    expect(mockClient.apiKeyStamper.stamp).toHaveBeenCalled()
    expect(mockClient.passkeyStamper.stamp).not.toHaveBeenCalled()
  })

  it('includes timestamp in request body', async () => {
    const mockClient = createMockClient(async () => ({
      session: 'session-jwt',
    }))

    await loginWithStamp(mockClient, {
      projectId: 'proj-456',
      organizationId: 'org-123',
      targetPublicKey: '03abcdef',
    })

    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), // ISO format
        }),
      }),
    )
  })

  it('propagates stamper errors', async () => {
    const mockClient = createMockClient()
    vi.mocked(mockClient.apiKeyStamper.stamp).mockRejectedValue(
      new Error('Stamper unavailable'),
    )

    await expect(
      loginWithStamp(mockClient, {
        projectId: 'proj-456',
        organizationId: 'org-123',
        targetPublicKey: '03abcdef',
      }),
    ).rejects.toThrow('Stamper unavailable')
  })
})

describe('registerWithPasskey', () => {
  it('sends passkey registration request with correct parameters', async () => {
    const attestation = {
      attestationObject: 'attestation-object-base64',
      clientDataJson: 'client-data-json-base64',
      credentialId: 'credential-id-123',
    }
    const mockClient = createMockClient(async () => ({
      userId: 'user-123',
      walletAddress: '0x1234567890abcdef',
      subOrganizationId: 'suborg-456',
    }))

    const result = await registerWithPasskey(mockClient, {
      projectId: 'proj-456',
      challenge: 'challenge-base64',
      attestation,
      encodedPublicKey: '03abcdef1234567890',
    })

    expect(mockClient.request).toHaveBeenCalledWith({
      path: 'proj-456/auth/register/passkey',
      method: 'POST',
      body: {
        attestation,
        challenge: 'challenge-base64',
        encodedPublicKey: '03abcdef1234567890',
      },
    })
    expect(result).toEqual({
      userId: 'user-123',
      walletAddress: '0x1234567890abcdef',
      subOrganizationId: 'suborg-456',
    })
  })

  it('handles registration failure', async () => {
    const mockClient = createMockClient(async () => {
      throw new Error('Invalid attestation')
    })

    await expect(
      registerWithPasskey(mockClient, {
        projectId: 'proj-456',
        challenge: 'challenge',
        attestation: {
          attestationObject: 'invalid',
          clientDataJson: 'invalid',
          credentialId: 'invalid',
        },
        encodedPublicKey: '03abcdef',
      }),
    ).rejects.toThrow('Invalid attestation')
  })
})

describe('getAuthenticators', () => {
  const mockResponse = {
    oauths: [
      { provider: 'google', clientId: 'some-client-id', subject: 'sub' },
    ],
    passkeys: [{ rpId: 'example.com', publicKey: 'pk', credentialId: 'cred' }],
    emailContacts: [{ email: 'user@example.com' }],
    apiKeys: [{ apiKey: 'compressed-pub-key' }],
  }

  it('sends authenticators request with correct parameters', async () => {
    const mockClient = createMockClient(async () => mockResponse)

    const result = await getAuthenticators(mockClient, {
      subOrganizationId: 'suborg-123',
      projectId: 'proj-456',
      token: 'test-token',
    })

    expect(mockClient.request).toHaveBeenCalledWith({
      path: 'proj-456/authenticators',
      method: 'POST',
      body: {
        subOrganizationId: 'suborg-123',
      },
      headers: {
        Authorization: 'Bearer test-token',
      },
      stamp: true,
      stampPostion: 'headers',
    })
    expect(result).toEqual(mockResponse)
  })

  it('returns authenticators grouped by type on success', async () => {
    const mockClient = createMockClient(async () => mockResponse)

    const result = await getAuthenticators(mockClient, {
      subOrganizationId: 'suborg-123',
      projectId: 'proj-456',
      token: 'test-token',
    })

    expect(result.oauths).toHaveLength(1)
    expect(result.passkeys).toHaveLength(1)
    expect(result.emailContacts?.[0]?.email).toBe('user@example.com')
    expect(result.apiKeys?.[0]?.apiKey).toBe('compressed-pub-key')
  })

  it('requests stamping', async () => {
    const mockClient = createMockClient(async () => mockResponse)

    await getAuthenticators(mockClient, {
      subOrganizationId: 'suborg-123',
      projectId: 'proj-456',
      token: 'test-token',
    })

    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        stamp: true,
      }),
    )
  })

  it('propagates errors', async () => {
    const mockClient = createMockClient(async () => {
      throw new Error('User not found')
    })

    await expect(
      getAuthenticators(mockClient, {
        subOrganizationId: 'suborg-123',
        projectId: 'proj-456',
        token: 'test-token',
      }),
    ).rejects.toThrow('User not found')
  })
})

describe('getWhoami', () => {
  it('sends whoami request with dual stamps', async () => {
    const mockClient = createMockClient(async () => ({
      userId: 'user-789',
      organizationId: 'org-123',
    }))

    const result = await getWhoami(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
    })

    // Should call stamper twice (inner stamp + outer stamp)
    expect(mockClient.apiKeyStamper.stamp).toHaveBeenCalledTimes(2)

    // Request should include stamp in body and X-Stamp header
    expect(mockClient.request).toHaveBeenCalledWith({
      path: 'proj-456/whoami',
      method: 'POST',
      body: {
        organizationId: 'org-123',
        stamp: {
          stampHeaderName: 'X-Stamp',
          stampHeaderValue: 'mock-stamp-value',
        },
      },
      headers: {
        'X-Stamp': 'mock-stamp-value',
      },
    })
    expect(result).toEqual({
      userId: 'user-789',
      organizationId: 'org-123',
    })
  })

  it('includes bearer token when provided', async () => {
    const mockClient = createMockClient(async () => ({
      userId: 'user-789',
      organizationId: 'org-123',
    }))

    await getWhoami(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'session-jwt',
    })

    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer session-jwt',
          'X-Stamp': 'mock-stamp-value',
        }),
      }),
    )
  })

  it('returns all user info fields when available', async () => {
    const mockClient = createMockClient(async () => ({
      userId: 'user-789',
      organizationId: 'org-123',
      organizationName: 'My Organization',
      username: 'john_doe',
    }))

    const result = await getWhoami(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
    })

    expect(result).toEqual({
      userId: 'user-789',
      organizationId: 'org-123',
      organizationName: 'My Organization',
      username: 'john_doe',
    })
  })

  it('propagates errors', async () => {
    const mockClient = createMockClient(async () => {
      throw new Error('Unauthorized')
    })

    await expect(
      getWhoami(mockClient, {
        organizationId: 'org-123',
        projectId: 'proj-456',
      }),
    ).rejects.toThrow('Unauthorized')
  })
})

describe('getOAuthLoginUrl', () => {
  it('GETs /oauth/google/login-url with correct query string', async () => {
    let captured: { path: string; method?: string } | undefined
    const mockClient = createMockClient(async (params) => {
      captured = { path: params.path, method: params.method }
      return 'https://accounts.google.com/o/oauth2/v2/auth?nonce=abc'
    })

    const result = await getOAuthLoginUrl(mockClient, {
      provider: 'google',
      projectId: 'proj-123',
      publicKey: '0xABCDEF1234567890',
      returnTo: 'https://app.example.com/cb?foo=bar',
    })

    expect(result).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth?nonce=abc',
    )
    expect(captured?.method).toBe('GET')
    // Path includes the query string; pub_key is 0x-stripped + lowercased
    const [path, qs] = (captured?.path ?? '').split('?')
    expect(path).toBe('oauth/google/login-url')
    const params = new URLSearchParams(qs)
    expect(params.get('project_id')).toBe('proj-123')
    expect(params.get('pub_key')).toBe('abcdef1234567890')
    expect(params.get('return_to')).toBe('https://app.example.com/cb?foo=bar')
  })

  it('throws on unsupported provider', async () => {
    const mockClient = createMockClient()
    await expect(
      getOAuthLoginUrl(mockClient, {
        provider: 'facebook' as 'google',
        projectId: 'proj-123',
        publicKey: '0xabcdef',
        returnTo: 'https://app.example.com',
      }),
    ).rejects.toThrow('Unsupported OAuth provider: facebook')
  })

  it('propagates transport errors', async () => {
    const mockClient = createMockClient(async () => {
      throw new Error('500 Internal Server Error')
    })
    await expect(
      getOAuthLoginUrl(mockClient, {
        provider: 'google',
        projectId: 'proj-123',
        publicKey: '0xabcdef',
        returnTo: 'https://app.example.com',
      }),
    ).rejects.toThrow('500 Internal Server Error')
  })
})
