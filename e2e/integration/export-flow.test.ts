/**
 * E2E integration test for wallet export.
 *
 * After OTP login, verifies that the SDK's export functions succeed against the
 * real backend / Turnkey and return well-formed encrypted export bundles:
 *   1. exportWallet       -> secret recovery phrase (seed phrase / mnemonic)
 *   2. exportPrivateKey   -> a wallet account private key
 *
 * Verification is STRUCTURAL: the returned bundle is HPKE-encrypted to a target
 * public key and is decrypted by the Turnkey iframe in production. There is no
 * iframe here, so we assert the bundle is a well-formed Turnkey export envelope
 * rather than decrypting it.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { exportPrivateKey } from '../../packages/core/src/utils/exportPrivateKey.js'
import { exportWallet } from '../../packages/core/src/utils/exportWallet.js'
import {
  getAuthProxyConfigId,
  waitForBackend,
} from '../helpers/backend-health.js'
import { BACKEND_URL } from '../helpers/constants.js'
import { completeOtpLogin } from '../helpers/otp-login.js'
import { ping } from '../helpers/temp-email.js'
import {
  asExportWallet,
  generateTargetPublicKey,
} from '../helpers/test-wallet.js'

/**
 * Asserts an `exportBundle` is a well-formed Turnkey signed export envelope.
 *
 * Envelope shape (from Turnkey's export format): a JSON string with
 * `version`, `data`, `dataSignature`, `enclaveQuorumPublic`, where `data` is a
 * hex-encoded JSON payload carrying the org id and the HPKE ciphertext.
 *
 * NOTE: the inner field names below (`encappedPublic`, `ciphertext`,
 * `organizationId`) are asserted from Turnkey-format knowledge. The first real
 * run is the source of truth — if they differ, log the raw bundle and tighten.
 */
function assertExportBundle(exportBundle: string, organizationId: string) {
  expect(typeof exportBundle).toBe('string')
  expect(exportBundle.length).toBeGreaterThan(0)

  const envelope = JSON.parse(exportBundle)
  expect(envelope).toHaveProperty('version')
  expect(envelope).toHaveProperty('data')
  expect(envelope).toHaveProperty('dataSignature')
  expect(envelope).toHaveProperty('enclaveQuorumPublic')
  expect(typeof envelope.data).toBe('string')

  // `data` is hex-encoded JSON.
  const decoded = JSON.parse(Buffer.from(envelope.data, 'hex').toString('utf8'))
  expect(decoded.organizationId).toBe(organizationId)
  // encappedPublic: uncompressed P-256 point (65 bytes -> 130 hex, 04 prefix).
  expect(typeof decoded.encappedPublic).toBe('string')
  expect(decoded.encappedPublic).toMatch(/^04[0-9a-fA-F]{128}$/)
  expect(typeof decoded.ciphertext).toBe('string')
  expect(decoded.ciphertext.length).toBeGreaterThan(0)
}

describe('Wallet Export', () => {
  let projectId: string
  let authProxyConfigId: string
  let skipReason = ''

  beforeAll(async () => {
    try {
      await waitForBackend(BACKEND_URL)
    } catch {
      skipReason = `Backend not reachable at ${BACKEND_URL}`
      return
    }

    try {
      await ping()
    } catch {
      skipReason = 'Email service unavailable'
      return
    }

    authProxyConfigId = await getAuthProxyConfigId(BACKEND_URL)

    projectId = process.env.ZD_PROJECT_ID || ''
    if (!projectId) {
      skipReason = 'ZD_PROJECT_ID not set'
      return
    }
  })

  it('should export the secret recovery phrase (seed phrase)', async (context) => {
    context.skip(!!skipReason, skipReason)

    const { client, session } = await completeOtpLogin(
      projectId,
      authProxyConfigId,
    )

    const targetPublicKey = generateTargetPublicKey()
    const wallet = asExportWallet(client, session)

    const { exportBundle, walletId, organizationId } = await exportWallet({
      wallet,
      targetPublicKey,
    })

    expect(walletId).toBeTruthy()
    expect(organizationId).toBe(session.organizationId)
    assertExportBundle(exportBundle, session.organizationId)

    console.log(
      `Seed phrase export OK: walletId=${walletId}, bundle bytes=${exportBundle.length}`,
    )
  })

  it('should export a wallet account private key', async (context) => {
    context.skip(!!skipReason, skipReason)

    const { client, session, sessionToken } = await completeOtpLogin(
      projectId,
      authProxyConfigId,
    )

    // Use a real wallet account address so toAccount() is never relied on.
    const userWallet = await client.getUserWallet({
      organizationId: session.organizationId,
      projectId,
      token: sessionToken,
    })
    expect(userWallet.walletAddresses.length).toBeGreaterThan(0)
    const address = userWallet.walletAddresses[0]!

    const targetPublicKey = generateTargetPublicKey()
    const wallet = asExportWallet(client, session, address)

    const result = await exportPrivateKey({
      wallet,
      targetPublicKey,
      address,
    })

    expect(result.address).toBe(address)
    expect(result.organizationId).toBe(session.organizationId)
    assertExportBundle(result.exportBundle, session.organizationId)

    console.log(
      `Private key export OK: address=${address}, bundle bytes=${result.exportBundle.length}`,
    )
  })
})
