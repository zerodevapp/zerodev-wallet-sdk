import { describe, expect, it, vi } from 'vitest'
import type { Client } from '../../client/types.js'
import { registerWithOTP } from './registerWithOTP.js'
import { verifyOTP } from './verifyOTP.js'

// Create a mock client
function createMockClient(
  requestImpl?: (params: {
    path: string
    method: string
    body?: unknown
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
    apiKeyStamper: {} as Client['apiKeyStamper'],
    passkeyStamper: {} as Client['passkeyStamper'],
    key: 'test-client',
    name: 'Test Client',
    type: 'zeroDevWalletClient',
    uid: 'test-uid',
    extend: vi.fn() as unknown as Client['extend'],
  }
}

describe('registerWithOTP', () => {
  it('sends OTP init request with correct parameters', async () => {
    const mockClient = createMockClient(async () => ({
      otpId: 'otp-123',
      otpEncryptionTargetBundle: 'bundle-stub',
    }))

    const result = await registerWithOTP(mockClient, {
      email: 'user@example.com',
      contact: {
        type: 'email',
        contact: 'user@example.com',
      },
      projectId: 'proj-456',
    })

    expect(mockClient.request).toHaveBeenCalledWith({
      path: 'proj-456/auth/init/otp',
      method: 'POST',
      body: {
        email: 'user@example.com',
        contact: {
          type: 'email',
          contact: 'user@example.com',
        },
      },
    })
    expect(result).toEqual({
      otpId: 'otp-123',
      otpEncryptionTargetBundle: 'bundle-stub',
    })
  })

  it('supports SMS contact type', async () => {
    const mockClient = createMockClient(async () => ({
      otpId: 'otp-sms',
      otpEncryptionTargetBundle: 'bundle-stub',
    }))

    await registerWithOTP(mockClient, {
      email: 'user@example.com',
      contact: {
        type: 'sms',
        contact: '+1234567890',
      },
      projectId: 'proj-456',
    })

    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          contact: {
            type: 'sms',
            contact: '+1234567890',
          },
        }),
      }),
    )
  })

  it('propagates request errors', async () => {
    const mockClient = createMockClient(async () => {
      throw new Error('Network error')
    })

    await expect(
      registerWithOTP(mockClient, {
        email: 'user@example.com',
        contact: { type: 'email', contact: 'user@example.com' },
        projectId: 'proj-456',
      }),
    ).rejects.toThrow('Network error')
  })
})

describe('verifyOTP', () => {
  const registration = {
    verificationToken: 'alias-1',
    subOrganizationId: 'suborg-1',
    userId: 'user-1',
    turnkeyUserId: 'tk-user-1',
    walletAddresses: ['0xabc'],
  }

  it('posts the otp id and the sealed bundle to verify/otp', async () => {
    const mockClient = createMockClient(async () => registration)

    const result = await verifyOTP(mockClient, {
      otpId: 'otp-123',
      encryptedOtpBundle: 'sealed-bundle',
      projectId: 'proj-456',
    })

    expect(mockClient.request).toHaveBeenCalledWith({
      path: 'proj-456/auth/verify/otp',
      method: 'POST',
      body: {
        otpId: 'otp-123',
        encryptedOtpBundle: 'sealed-bundle',
      },
    })
    expect(result).toEqual(registration)
  })

  it('does not stamp: the sealed bundle carries the session key', async () => {
    const mockClient = createMockClient(async () => registration)

    await verifyOTP(mockClient, {
      otpId: 'otp-123',
      encryptedOtpBundle: 'sealed-bundle',
      projectId: 'proj-456',
    })

    const args = vi.mocked(mockClient.request).mock.calls[0][0]
    expect(args).not.toHaveProperty('stamp')
    expect(args).not.toHaveProperty('headers')
  })

  it('propagates request errors', async () => {
    const mockClient = createMockClient(async () => {
      throw new Error('Invalid OTP code')
    })

    await expect(
      verifyOTP(mockClient, {
        otpId: 'otp-123',
        encryptedOtpBundle: 'sealed-bundle',
        projectId: 'proj-456',
      }),
    ).rejects.toThrow('Invalid OTP code')
  })
})
