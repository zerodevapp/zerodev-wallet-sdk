import { describe, expect, it, vi } from 'vitest'
import type { Client } from '../../client/types.js'
import { loginWithOTP } from './loginWithOTP.js'
import { registerWithOTP } from './registerWithOTP.js'

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
    indexedDbStamper: {} as Client['indexedDbStamper'],
    webauthnStamper: {} as Client['webauthnStamper'],
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
        emailCustomization: undefined,
      },
    })
    expect(result).toEqual({
      otpId: 'otp-123',
      otpEncryptionTargetBundle: 'bundle-stub',
    })
  })

  it('includes email customization when provided', async () => {
    const mockClient = createMockClient(async () => ({
      otpId: 'otp-123',
      otpEncryptionTargetBundle: 'bundle-stub',
    }))

    await registerWithOTP(mockClient, {
      email: 'user@example.com',
      contact: {
        type: 'email',
        contact: 'user@example.com',
      },
      projectId: 'proj-456',
      emailCustomization: {
        magicLinkTemplate: 'https://example.com/verify/%s',
      },
    })

    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          emailCustomization: {
            magicLinkTemplate: 'https://example.com/verify/%s',
          },
        }),
      }),
    )
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

describe('loginWithOTP', () => {
  it('sends OTP login request with correct parameters', async () => {
    const mockClient = createMockClient(async () => ({
      session: 'session-jwt-token',
    }))

    const result = await loginWithOTP(mockClient, {
      verificationToken: 'verification-jwt',
      clientSignature: 'a1'.repeat(64),
      projectId: 'proj-456',
    })

    expect(mockClient.request).toHaveBeenCalledWith({
      path: 'proj-456/auth/login/otp',
      method: 'POST',
      body: {
        verificationToken: 'verification-jwt',
        clientSignature: 'a1'.repeat(64),
      },
    })
    expect(result).toEqual({ session: 'session-jwt-token' })
  })

  it('returns session token on successful login', async () => {
    const expectedSession = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...'
    const mockClient = createMockClient(async () => ({
      session: expectedSession,
    }))

    const result = await loginWithOTP(mockClient, {
      verificationToken: 'verification-jwt',
      clientSignature: 'a1'.repeat(64),
      projectId: 'proj-456',
    })

    expect(result.session).toBe(expectedSession)
  })

  it('propagates request errors', async () => {
    const mockClient = createMockClient(async () => {
      throw new Error('Invalid verification token')
    })

    await expect(
      loginWithOTP(mockClient, {
        verificationToken: 'invalid-token',
        clientSignature: 'a1'.repeat(64),
        projectId: 'proj-456',
      }),
    ).rejects.toThrow('Invalid verification token')
  })

  it('uses project ID in the request path', async () => {
    const mockClient = createMockClient(async () => ({ session: 'jwt' }))

    await loginWithOTP(mockClient, {
      verificationToken: 'token',
      clientSignature: 'sig',
      projectId: 'my-custom-project-id',
    })

    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'my-custom-project-id/auth/login/otp',
      }),
    )
  })
})
