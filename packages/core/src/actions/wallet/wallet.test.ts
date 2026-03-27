import { hashMessage, keccak256, toHex } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import type { Client } from '../../client/types.js'
import { getUserWallet } from './getUserWallet.js'
import { sign7702Authorization } from './sign7702Authorization.js'
import {
  buildTurnkeyPayload,
  computeDataPayloadHash,
  computeMessagePayloadHash,
} from './signingUtils.js'
import { signMessage } from './signMessage.js'
import { signTransaction } from './signTransaction.js'
import { signTypedDataV4 } from './signTypedDataV4.js'
import { signUserOperation } from './signUserOperation.js'

function createMockClient(
  requestImpl?: (params: {
    path: string
    method?: string
    body?: any
    headers?: Record<string, string>
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
    indexedDbStamper: {
      stamp: vi.fn(async () => ({
        stampHeaderName: 'X-Stamp-Webauthn',
        stampHeaderValue: 'mock-stamp-value',
      })),
      getPublicKey: vi.fn(async () => 'mock-public-key'),
      init: vi.fn(async () => {}),
    } as unknown as Client['indexedDbStamper'],
    webauthnStamper: {} as Client['webauthnStamper'],
    key: 'test-client',
    name: 'Test Client',
    type: 'zeroDevWalletClient',
    uid: 'test-uid',
    extend: vi.fn() as unknown as Client['extend'],
  }
}

// ----- Hash computation tests (must match backend exactly) -----

describe('computeMessagePayloadHash', () => {
  it('computes correct hash for utf8 message (matches viem hashMessage)', () => {
    const hash = computeMessagePayloadHash('Hello', 'utf8')
    expect(hash).toBe(hashMessage('Hello').slice(2))
  })

  it('computes correct hash for hex message', () => {
    const hexMsg = '48656c6c6f' // "Hello" in hex
    const hash = computeMessagePayloadHash(hexMsg, 'hex')
    expect(hash).toBe(hashMessage({ raw: `0x${hexMsg}` }).slice(2))
  })

  it('utf8 and hex produce same hash for equivalent input', () => {
    // "Hello" as utf8 should produce the same hash as "48656c6c6f" as hex
    const utf8Hash = computeMessagePayloadHash('Hello', 'utf8')
    const hexHash = computeMessagePayloadHash('48656c6c6f', 'hex')
    expect(utf8Hash).toBe(hexHash)
  })

  it('strips 0x prefix from hex input', () => {
    const withPrefix = computeMessagePayloadHash('0x48656c6c6f', 'hex')
    const withoutPrefix = computeMessagePayloadHash('48656c6c6f', 'hex')
    expect(withPrefix).toBe(withoutPrefix)
  })

  it('returns hash without 0x prefix', () => {
    const hash = computeMessagePayloadHash('Hello', 'utf8')
    expect(hash).not.toMatch(/^0x/)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('uses correct length for multi-byte utf8 characters', () => {
    const hash = computeMessagePayloadHash('é', 'utf8')
    expect(hash).toBe(hashMessage('é').slice(2))
  })
})

describe('computeDataPayloadHash', () => {
  it('computes correct hash for utf8 data (hashes raw bytes)', () => {
    const data = '{"chainId":"1"}'
    const hash = computeDataPayloadHash(data, 'utf8')

    // Should hash the raw bytes, not the hex string chars
    const hexData = toHex(data).slice(2)
    const expected = keccak256(`0x${hexData}`).slice(2)
    expect(hash).toBe(expected)
  })

  it('computes correct hash for hex data (hashes raw bytes)', () => {
    const hexData = 'f86c808504a817c80082520894'
    const hash = computeDataPayloadHash(hexData, 'hex')

    const expected = keccak256(`0x${hexData}`).slice(2)
    expect(hash).toBe(expected)
  })

  it('utf8 and hex produce same hash for equivalent input', () => {
    const utf8Hash = computeDataPayloadHash('Hello', 'utf8')
    const hexHash = computeDataPayloadHash('48656c6c6f', 'hex')
    expect(utf8Hash).toBe(hexHash)
  })

  it('strips 0x prefix from hex input', () => {
    const withPrefix = computeDataPayloadHash('0xdeadbeef', 'hex')
    const withoutPrefix = computeDataPayloadHash('deadbeef', 'hex')
    expect(withPrefix).toBe(withoutPrefix)
  })

  it('returns hash without 0x prefix', () => {
    const hash = computeDataPayloadHash('test', 'utf8')
    expect(hash).not.toMatch(/^0x/)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

// ----- buildTurnkeyPayload tests -----

describe('buildTurnkeyPayload', () => {
  it('builds correct payload structure', () => {
    const payload = buildTurnkeyPayload(
      'org-123',
      '0x1234567890abcdef1234567890abcdef12345678',
      'deadbeef',
    )

    expect(payload.type).toBe('ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2')
    expect(payload.organizationId).toBe('org-123')
    expect(payload.parameters.signWith).toBe(
      '0x1234567890abcdef1234567890abcdef12345678',
    )
    expect(payload.parameters.payload).toBe('deadbeef')
    expect(payload.parameters.encoding).toBe('PAYLOAD_ENCODING_HEXADECIMAL')
    expect(payload.parameters.hashFunction).toBe('HASH_FUNCTION_NO_OP')
  })

  it('includes timestampMs as string', () => {
    const before = Date.now()
    const payload = buildTurnkeyPayload('org', '0x00', 'hash')
    const after = Date.now()

    const ts = Number.parseInt(payload.timestampMs, 10)
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })
})

// ----- signMessage tests -----

describe('signMessage', () => {
  it('sends signing request with dual-stamp pattern', async () => {
    const mockClient = createMockClient(async () => ({
      signature: 'abcdef1234567890',
    }))

    const result = await signMessage(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'bearer-token-jwt',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      message: 'Hello',
      encoding: 'utf8',
    })

    // Inner stamp + outer stamp = 2 calls
    expect(mockClient.indexedDbStamper.stamp).toHaveBeenCalledTimes(2)

    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'proj-456/sign/message',
        method: 'POST',
      }),
    )

    // Outer stamp in headers
    const requestCall = vi.mocked(mockClient.request).mock.calls[0][0]
    expect(requestCall.headers!['X-Stamp-Webauthn']).toBe('mock-stamp-value')
    expect(requestCall.headers!.Authorization).toBe('Bearer bearer-token-jwt')

    expect(result).toBe('0xabcdef1234567890')
  })

  it('inner stamp is computed over canonicalized turnkeyPayload', async () => {
    const mockClient = createMockClient(async () => ({
      signature: 'sig',
    }))

    await signMessage(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      message: 'Hello',
      encoding: 'utf8',
    })

    // First stamp call is the inner stamp over turnkeyPayload
    const innerStampInput = vi.mocked(mockClient.indexedDbStamper.stamp).mock
      .calls[0][0]
    const parsed = JSON.parse(innerStampInput)
    expect(parsed.type).toBe('ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2')
    expect(parsed.parameters.signWith).toBe(
      '0x1234567890abcdef1234567890abcdef12345678',
    )
    expect(parsed.parameters.encoding).toBe('PAYLOAD_ENCODING_HEXADECIMAL')
    expect(parsed.parameters.hashFunction).toBe('HASH_FUNCTION_NO_OP')
  })

  it('outer stamp is computed over canonicalized full body', async () => {
    const mockClient = createMockClient(async () => ({
      signature: 'sig',
    }))

    await signMessage(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      message: 'Hello',
      encoding: 'utf8',
    })

    // Second stamp call is the outer stamp over the full body
    const outerStampInput = vi.mocked(mockClient.indexedDbStamper.stamp).mock
      .calls[1][0]
    const parsed = JSON.parse(outerStampInput)
    expect(parsed.message).toBe('Hello')
    expect(parsed.encoding).toBe('utf8')
    expect(parsed.turnkeyPayload).toBeDefined()
    expect(parsed.stampHeader.stampHeaderName).toBe('X-Stamp-Webauthn')
    expect(parsed.stampHeader.stampHeaderValue).toBe('mock-stamp-value')
  })

  it('body contains correct human-readable fields and turnkey payload', async () => {
    const mockClient = createMockClient(async () => ({
      signature: 'sig',
    }))

    await signMessage(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      message: 'Hello',
      encoding: 'utf8',
    })

    const requestCall = vi.mocked(mockClient.request).mock.calls[0][0]
    const body = requestCall.body

    // Human-readable fields
    expect(body.message).toBe('Hello')
    expect(body.encoding).toBe('utf8')

    // Turnkey payload with correct hash
    const expectedHash = computeMessagePayloadHash('Hello', 'utf8')
    expect(body.turnkeyPayload.parameters.payload).toBe(expectedHash)
    expect(body.turnkeyPayload.parameters.signWith).toBe(
      '0x1234567890abcdef1234567890abcdef12345678',
    )
    expect(body.turnkeyPayload.organizationId).toBe('org-123')

    // Embedded inner stamp
    expect(body.stampHeader.stampHeaderName).toBe('X-Stamp-Webauthn')
    expect(body.stampHeader.stampHeaderValue).toBe('mock-stamp-value')
  })

  it('handles hex encoding', async () => {
    const mockClient = createMockClient(async () => ({
      signature: 'deadbeef',
    }))

    await signMessage(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      message: '48656c6c6f',
      encoding: 'hex',
    })

    const requestCall = vi.mocked(mockClient.request).mock.calls[0][0]
    expect(requestCall.body.message).toBe('48656c6c6f')
    expect(requestCall.body.encoding).toBe('hex')
  })

  it('propagates signing errors', async () => {
    const mockClient = createMockClient(async () => {
      throw new Error('Signing failed')
    })

    await expect(
      signMessage(mockClient, {
        organizationId: 'org-123',
        projectId: 'proj-456',
        token: 'token',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        message: 'Hello',
        encoding: 'utf8',
      }),
    ).rejects.toThrow('Signing failed')
  })
})

// ----- signTransaction tests -----

describe('signTransaction', () => {
  it('sends signing request with dual-stamp pattern', async () => {
    const mockClient = createMockClient(async () => ({
      signature: 'abcdef1234567890',
    }))

    const result = await signTransaction(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'bearer-token-jwt',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      unsignedTransaction: 'f86c808504a817c80082520894',
    })

    expect(mockClient.indexedDbStamper.stamp).toHaveBeenCalledTimes(2)

    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'proj-456/sign/transaction',
        method: 'POST',
      }),
    )

    expect(result).toBe('0xabcdef1234567890')
  })

  it('body contains correct hash in turnkey payload', async () => {
    const tx = 'f86c808504a817c80082520894'
    const mockClient = createMockClient(async () => ({
      signature: 'sig',
    }))

    await signTransaction(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      unsignedTransaction: tx,
    })

    const requestCall = vi.mocked(mockClient.request).mock.calls[0][0]
    const expectedHash = computeDataPayloadHash(tx, 'hex')
    expect(requestCall.body.turnkeyPayload.parameters.payload).toBe(
      expectedHash,
    )
    expect(requestCall.body.unsignedTransaction).toBe(tx)
    expect(requestCall.body.encoding).toBe('hex')
  })

  it('defaults encoding to hex', async () => {
    const mockClient = createMockClient(async () => ({
      signature: 'sig',
    }))

    await signTransaction(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      unsignedTransaction: 'tx',
    })

    const requestCall = vi.mocked(mockClient.request).mock.calls[0][0]
    expect(requestCall.body.encoding).toBe('hex')
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
  })

  it('does not double-prefix when server returns 0x', async () => {
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

    expect(result).toBe('0xdeadbeef')
  })

  it('includes authorization header with bearer token', async () => {
    const mockClient = createMockClient(async () => ({
      signature: 'sig',
    }))

    await signTransaction(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'my-secret-token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      unsignedTransaction: 'tx',
    })

    const requestCall = vi.mocked(mockClient.request).mock.calls[0][0]
    expect(requestCall.headers!.Authorization).toBe('Bearer my-secret-token')
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

// ----- signTypedDataV4 tests -----

describe('signTypedDataV4', () => {
  it('sends signing request with dual-stamp pattern', async () => {
    const typedData = '{"domain":{"chainId":"1"},"types":{}}'
    const mockClient = createMockClient(async () => ({
      signature: 'abcdef',
    }))

    const result = await signTypedDataV4(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      unsignedTypedDataV4: typedData,
      encoding: 'utf8',
      typedDataHash: 'deadbeef'.repeat(8),
    })

    expect(mockClient.indexedDbStamper.stamp).toHaveBeenCalledTimes(2)
    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'proj-456/sign/typed-data-v4',
        method: 'POST',
      }),
    )
    expect(result).toBe('0xabcdef')
  })

  it('body contains correct hash in turnkey payload', async () => {
    const typedData = '{"domain":{"chainId":"1"},"types":{}}'
    const precomputedHash = 'deadbeef'.repeat(8)
    const mockClient = createMockClient(async () => ({
      signature: 'sig',
    }))

    await signTypedDataV4(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      unsignedTypedDataV4: typedData,
      encoding: 'utf8',
      typedDataHash: precomputedHash,
    })

    const requestCall = vi.mocked(mockClient.request).mock.calls[0][0]
    expect(requestCall.body.turnkeyPayload.parameters.payload).toBe(
      precomputedHash,
    )
    expect(requestCall.body.unsignedTypedDataV4).toBe(typedData)
    expect(requestCall.body.encoding).toBe('utf8')
  })

  it('propagates signing errors', async () => {
    const mockClient = createMockClient(async () => {
      throw new Error('Invalid typed data')
    })

    await expect(
      signTypedDataV4(mockClient, {
        organizationId: 'org-123',
        projectId: 'proj-456',
        token: 'token',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        unsignedTypedDataV4: '{}',
        encoding: 'utf8',
        typedDataHash: 'deadbeef'.repeat(8),
      }),
    ).rejects.toThrow('Invalid typed data')
  })
})

// ----- signUserOperation tests -----

describe('signUserOperation', () => {
  it('sends signing request with dual-stamp pattern and chainId', async () => {
    const mockClient = createMockClient(async () => ({
      signature: 'abcdef',
    }))

    const result = await signUserOperation(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      unsignedUserOperation: 'userop-data',
      chainId: 42161,
      encoding: 'hex',
    })

    expect(mockClient.indexedDbStamper.stamp).toHaveBeenCalledTimes(2)
    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'proj-456/sign/user-operation',
        method: 'POST',
      }),
    )
    expect(result).toBe('0xabcdef')
  })

  it('body contains correct hash, chainId, and encoding', async () => {
    const mockClient = createMockClient(async () => ({
      signature: 'sig',
    }))

    await signUserOperation(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      unsignedUserOperation: 'userop-hex',
      chainId: 1,
      encoding: 'hex',
    })

    const requestCall = vi.mocked(mockClient.request).mock.calls[0][0]
    const expectedHash = computeDataPayloadHash('userop-hex', 'hex')
    expect(requestCall.body.turnkeyPayload.parameters.payload).toBe(
      expectedHash,
    )
    expect(requestCall.body.unsignedUserOperation).toBe('userop-hex')
    expect(requestCall.body.chainId).toBe(1)
    expect(requestCall.body.encoding).toBe('hex')
  })

  it('propagates signing errors', async () => {
    const mockClient = createMockClient(async () => {
      throw new Error('Chain not allowed')
    })

    await expect(
      signUserOperation(mockClient, {
        organizationId: 'org-123',
        projectId: 'proj-456',
        token: 'token',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        unsignedUserOperation: 'op',
        chainId: 1,
        encoding: 'hex',
      }),
    ).rejects.toThrow('Chain not allowed')
  })
})

// ----- sign7702Authorization tests -----

describe('sign7702Authorization', () => {
  it('sends signing request with dual-stamp pattern', async () => {
    const mockClient = createMockClient(async () => ({
      signature: 'abcdef',
    }))

    const result = await sign7702Authorization(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      chainId: 1,
      hashedAuthorization: 'deadbeef'.repeat(8),
    })

    expect(mockClient.indexedDbStamper.stamp).toHaveBeenCalledTimes(2)
    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'proj-456/sign/7702-authorization',
        method: 'POST',
      }),
    )
    expect(result).toBe('0xabcdef')
  })

  it('passes hashed authorization directly as turnkey payload (no SDK hash)', async () => {
    const hashedAuth = 'deadbeef'.repeat(8)
    const mockClient = createMockClient(async () => ({
      signature: 'sig',
    }))

    await sign7702Authorization(mockClient, {
      organizationId: 'org-123',
      projectId: 'proj-456',
      token: 'token',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      chainId: 1,
      hashedAuthorization: hashedAuth,
    })

    const requestCall = vi.mocked(mockClient.request).mock.calls[0][0]
    // Hash is passed through directly (no SDK computation)
    expect(requestCall.body.turnkeyPayload.parameters.payload).toBe(hashedAuth)
    // Body only contains chainId (as number), not the hash
    expect(requestCall.body.chainId).toBe(1)
    expect(requestCall.body.hashedAuthorization).toBeUndefined()
    expect(requestCall.body.message).toBeUndefined()
  })

  it('propagates signing errors', async () => {
    const mockClient = createMockClient(async () => {
      throw new Error('Chain not allowed')
    })

    await expect(
      sign7702Authorization(mockClient, {
        organizationId: 'org-123',
        projectId: 'proj-456',
        token: 'token',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 1,
        hashedAuthorization: 'hash',
      }),
    ).rejects.toThrow('Chain not allowed')
  })
})

// ----- getUserWallet tests -----

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
