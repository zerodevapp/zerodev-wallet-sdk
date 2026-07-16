/**
 * Shared response factories for mock backend handlers.
 *
 * Single source of truth for all mocked response payloads. Imported by both
 * the Node MSW server (`mock-backend-node.ts`) and the Playwright route mocks
 * (`mock-backend.ts`) so the two environments always return identical data.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createMockSessionJwt,
  createMockVerificationToken,
} from './mock-session.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const MOCK_PROJECT_ID = 'mock-project-id'
export const MOCK_AUTH_PROXY_CONFIG_ID = 'mock-auth-proxy-config-id'
export const MOCK_PARENT_ORG_ID = 'mock-parent-org-id'
export const MOCK_OTP_CODE = '000000'

export const MOCK_OTP_SIGNER_PUBLIC_KEY: string = readFileSync(
  path.join(__dirname, '..', 'fixtures', 'test-signer-public-key.txt'),
  'utf-8',
).trim()

export function getTestOtpBundle(): string {
  return readFileSync(
    path.join(__dirname, '..', 'fixtures', 'test-otp-bundle.json'),
    'utf-8',
  )
}

export const FAKE_SIGNATURE = '0x' + 'ab'.repeat(32) + 'cd'.repeat(32) + '01'

export const mockResponses = {
  authProxyId: () => ({ authProxyConfigId: MOCK_AUTH_PROXY_CONFIG_ID }),
  parentOrgId: () => ({ parentOrgId: MOCK_PARENT_ORG_ID }),
  otpInit: () => ({
    otpId: 'mock-otp-id-abc123',
    otpEncryptionTargetBundle: getTestOtpBundle(),
  }),
  otpVerify: () => ({ verificationToken: createMockVerificationToken() }),
  otpLogin: () => ({ session: createMockSessionJwt() }),
  stampLogin: () => ({ session: createMockSessionJwt() }),
  whoami: () => ({ userId: 'mock-user-id', organizationId: 'mock-org-id' }),
  userWallet: () => ({
    walletAddresses: ['0x000000000000000000000000000000000000dEaD'],
  }),
  signMessage: () => ({ signature: FAKE_SIGNATURE }),
  signTypedData: () => ({ signature: FAKE_SIGNATURE }),
}
