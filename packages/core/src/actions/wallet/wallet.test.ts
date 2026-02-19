import { describe, expect, it, vi } from 'vitest'
import type { Client } from '../../client/types.js'
import { getUserWallet } from './getUserWallet.js'
import { signRawPayload } from './signRawPayload.js'
import { signTransaction } from './signTransaction.js'

// Create a mock client with configurable request implementation
function createMockClient(
  requestImpl?: (params: {
    path: string
    method?: string
    body?: unknown
    headers?: Record<string, string>
    stamp?: boolean
    stampPostion?: string
  }) => Promise<unknown>,
): Client {
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
    indexedDbStamper: {} as Client['indexedDbStamper'],
    webauthnStamper: {} as Client['webauthnStamper'],
    key: 'test-client',
    name: 'Test Client',
    type: 'zeroDevWalletClient',
    uid: 'test-uid',
    extend: vi.fn() as unknown as Client['extend'],
  }
}

describe('signTransaction', () => {
  it('sends sign transaction request with correct parameters', async () => {
    const signatureHex = 'abcdef1234567890'
    const mockClient = createMockClient(async () => ({
      signature: signatureHex,
    }))

    const result = await signTransaction(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'bearer-token-jwt',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      unsignedTransaction: 'f86c808504a817c80082520894...',
    })

    expect(mockClient.request).toHaveBeenCalledWith({
      path: 'proj-456/sign/transaction',
      body: {
        type: 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2',
        timestampMs: expect.any(String),
        organizationId: 'org-123',
        parameters: {
          signWith: '0x1234567890abcdef1234567890abcdef12345678',
          type: 'TRANSACTION_TYPE_ETHEREUM',
          unsignedTransaction: 'f86c808504a817c80082520894...',
        },
      },
      headers: {
        Authorization: 'Bearer bearer-token-jwt',
      },
      stamp: true,
      stampPostion: 'headers',
    })
    expect(result).toBe(`0x${signatureHex}`)
  })

  it('returns signature with 0x prefix', async () => {
    const mockClient = createMockClient(async () => ({
      signature: 'deadbeef',
    }))

    const result = await signTransaction(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      unsignedTransaction: 'unsigned-tx',
    })

    expect(result).toBe('0xdeadbeef')
    expect(result.startsWith('0x')).toBe(true)
  })

  it('includes authorization header with bearer token', async () => {
    const mockClient = createMockClient(async () => ({ signature: 'sig' }))

    await signTransaction(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'my-secret-token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      unsignedTransaction: 'tx',
    })

    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer my-secret-token',
        },
      }),
    )
  })

  it('requests stamping in headers', async () => {
    const mockClient = createMockClient(async () => ({ signature: 'sig' }))

    await signTransaction(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      unsignedTransaction: 'tx',
    })

    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        stamp: true,
        stampPostion: 'headers',
      }),
    )
  })

  it('includes timestamp in milliseconds', async () => {
    const mockClient = createMockClient(async () => ({ signature: 'sig' }))

    await signTransaction(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      unsignedTransaction: 'tx',
    })

    const requestCall = vi.mocked(mockClient.request).mock.calls[0][0]
    const timestampMs = (requestCall as { body: { timestampMs: string } }).body
      .timestampMs
    expect(parseInt(timestampMs, 10)).toBeGreaterThan(0)
    expect(parseInt(timestampMs, 10).toString()).toBe(timestampMs)
  })

  it('unconditionally prepends 0x (double prefix if server returns 0x)', async () => {
    // The source unconditionally does `0x${signature}`, so if server returns '0xdeadbeef',
    // result will be '0x0xdeadbeef' - documenting this behavior
    const mockClient = createMockClient(async () => ({
      signature: '0xdeadbeef',
    }))

    const result = await signTransaction(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      unsignedTransaction: 'tx',
    })

    expect(result).toBe('0x0xdeadbeef')
  })

  it('includes timestamp close to current time', async () => {
    const before = Date.now()
    const mockClient = createMockClient(async () => ({ signature: 'sig' }))

    await signTransaction(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      unsignedTransaction: 'tx',
    })

    const after = Date.now()
    const requestCall = vi.mocked(mockClient.request).mock.calls[0][0]
    const timestampMs = Number.parseInt(
      (requestCall as { body: { timestampMs: string } }).body.timestampMs,
      10,
    )
    expect(timestampMs).toBeGreaterThanOrEqual(before)
    expect(timestampMs).toBeLessThanOrEqual(after)
  })

  it('propagates signing errors', async () => {
    const mockClient = createMockClient(async () => {
      throw new Error('Signing failed: insufficient funds')
    })

    await expect(
      signTransaction(mockClient, {
        organizationId: 'org-123',
        projectId: 'proj-456',
        token: 'token',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        unsignedTransaction: 'tx',
      }),
    ).rejects.toThrow('Signing failed: insufficient funds')
  })
})

describe('getUserWallet', () => {
  it('sends get user wallet request with correct parameters', async () => {
    const mockClient = createMockClient(async () => ({
      walletAddresses: [
        '0x1234567890abcdef1234567890abcdef12345678',
        '0xabcdef1234567890abcdef1234567890abcdef12',
      ],
      userId: 'user-123',
    }))

    const result = await getUserWallet(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'bearer-token-jwt',
    })

    expect(mockClient.request).toHaveBeenCalledWith({
      path: 'proj-456/user-wallet',
      body: {
        organizationId: 'org-123',
      },
      headers: {
        Authorization: 'Bearer bearer-token-jwt',
      },
      stamp: true,
      stampPostion: 'headers',
    })
    expect(result).toEqual({
      walletAddresses: [
        '0x1234567890abcdef1234567890abcdef12345678',
        '0xabcdef1234567890abcdef1234567890abcdef12',
      ],
      userId: 'user-123',
    })
  })

  it('returns wallet addresses without userId', async () => {
    const mockClient = createMockClient(async () => ({
      walletAddresses: ['0x1234567890abcdef1234567890abcdef12345678'],
    }))

    const result = await getUserWallet(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
    })

    expect(result.walletAddresses).toEqual([
      '0x1234567890abcdef1234567890abcdef12345678',
    ])
    expect(result.userId).toBeUndefined()
  })

  it('returns empty wallet addresses array', async () => {
    const mockClient = createMockClient(async () => ({
      walletAddresses: [],
    }))

    const result = await getUserWallet(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
    })

    expect(result.walletAddresses).toEqual([])
  })

  it('includes authorization header with bearer token', async () => {
    const mockClient = createMockClient(async () => ({ walletAddresses: [] }))

    await getUserWallet(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'my-secret-token',
    })

    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer my-secret-token',
        },
      }),
    )
  })

  it('requests stamping in headers', async () => {
    const mockClient = createMockClient(async () => ({ walletAddresses: [] }))

    await getUserWallet(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
    })

    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        stamp: true,
        stampPostion: 'headers',
      }),
    )
  })

  it('propagates errors', async () => {
    const mockClient = createMockClient(async () => {
      throw new Error('User not found')
    })

    await expect(
      getUserWallet(mockClient, {
        organizationId: 'org-123',
        projectId: 'proj-456',
        token: 'token',
      }),
    ).rejects.toThrow('User not found')
  })
})

describe('signRawPayload', () => {
  it('sends sign raw payload request with default encoding and hash function', async () => {
    const signatureHex = '0x1234567890abcdef' as const
    const mockClient = createMockClient(async () => ({
      signature: signatureHex,
    }))

    const result = await signRawPayload(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'bearer-token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      payload: 'deadbeef1234567890',
    })

    expect(mockClient.request).toHaveBeenCalledWith({
      path: 'proj-456/sign/raw-payload',
      body: {
        type: 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2',
        timestampMs: expect.any(String),
        organizationId: 'org-123',
        parameters: {
          signWith: '0x1234567890abcdef1234567890abcdef12345678',
          payload: 'deadbeef1234567890',
          encoding: 'PAYLOAD_ENCODING_HEXADECIMAL',
          hashFunction: 'HASH_FUNCTION_NO_OP',
        },
      },
      headers: {
        Authorization: 'Bearer bearer-token',
      },
      stamp: true,
      stampPostion: 'headers',
    })
    expect(result).toBe(signatureHex)
  })

  it('allows custom encoding type', async () => {
    const mockClient = createMockClient(async () => ({ signature: '0xsig' }))

    await signRawPayload(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      payload: 'payload',
      encoding: 'PAYLOAD_ENCODING_EIP712',
    })

    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          parameters: expect.objectContaining({
            encoding: 'PAYLOAD_ENCODING_EIP712',
          }),
        }),
      }),
    )
  })

  it('allows custom hash function', async () => {
    const mockClient = createMockClient(async () => ({ signature: '0xsig' }))

    await signRawPayload(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      payload: 'payload',
      hashFunction: 'HASH_FUNCTION_NO_OP',
    })

    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          parameters: expect.objectContaining({
            hashFunction: 'HASH_FUNCTION_NO_OP',
          }),
        }),
      }),
    )
  })

  it('returns signature as-is without adding 0x prefix', async () => {
    // Unlike signTransaction, signRawPayload does NOT prepend 0x
    const mockClient = createMockClient(async () => ({
      signature: 'abcdef123456',
    }))

    const result = await signRawPayload(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      payload: 'payload',
    })

    // Returned as-is, no 0x prepended
    expect(result).toBe('abcdef123456')
  })

  it('returns signature with 0x prefix unchanged', async () => {
    const mockClient = createMockClient(async () => ({
      signature: '0xabcdef123456',
    }))

    const result = await signRawPayload(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      payload: 'payload',
    })

    expect(result).toBe('0xabcdef123456')
  })

  it('requests stamping in headers', async () => {
    const mockClient = createMockClient(async () => ({ signature: '0xsig' }))

    await signRawPayload(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      payload: 'payload',
    })

    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        stamp: true,
        stampPostion: 'headers',
      }),
    )
  })

  it('propagates signing errors', async () => {
    const mockClient = createMockClient(async () => {
      throw new Error('Invalid payload encoding')
    })

    await expect(
      signRawPayload(mockClient, {
        organizationId: 'org-123',
        projectId: 'proj-456',
        token: 'token',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        payload: 'invalid-payload',
      }),
    ).rejects.toThrow('Invalid payload encoding')
  })
})
