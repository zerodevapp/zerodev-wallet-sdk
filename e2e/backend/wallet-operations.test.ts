/**
 * Backend E2E test for wallet operations after authentication.
 *
 * After OTP login:
 * 1. Get user wallet addresses
 * 2. Exercise every signing route against the real backend
 */

import { recoverTransactionAddress } from 'viem'
import { beforeAll, describe, expect, it } from 'vitest'
import { toViemAccount } from '../../packages/core/src/adapters/viem.js'
import { getAuthProxyConfigId } from '../helpers/backend-health.js'
import { BACKEND_URL } from '../helpers/constants.js'
import { completeOtpLogin } from '../helpers/otp-login.js'

const CHAIN_ID = 421614

describe('Wallet Operations', () => {
  let projectId: string
  let authProxyConfigId: string

  beforeAll(async () => {
    // Backend reachability, email service, and project-id env are enforced once
    // in global-setup.ts, which fails the whole run if any are unmet.
    authProxyConfigId = await getAuthProxyConfigId(BACKEND_URL)
    projectId = process.env.ZD_OTP_PROJECT_ID || ''
  })

  it('should get user wallet addresses after login', async () => {
    const { client, session, sessionToken } = await completeOtpLogin(
      projectId,
      authProxyConfigId,
    )

    const wallet = await client.getUserWallet({
      organizationId: session.organizationId,
      projectId,
      token: sessionToken,
    })

    expect(wallet.walletAddresses).toBeDefined()
    expect(Array.isArray(wallet.walletAddresses)).toBe(true)
    expect(wallet.walletAddresses.length).toBeGreaterThan(0)

    for (const addr of wallet.walletAddresses) {
      expect(addr).toMatch(/^0x[a-fA-F0-9]{40}$/)
    }

    console.log(`Wallet addresses: ${wallet.walletAddresses.join(', ')}`)
  })

  it('should sign every supported payload after login', async () => {
    const { client, session, sessionToken } = await completeOtpLogin(
      projectId,
      authProxyConfigId,
    )

    const account = await toViemAccount({
      client,
      organizationId: session.organizationId,
      projectId,
      getToken: () => sessionToken,
    })

    const messageSignature = await account.signMessage({
      message: 'Hello, World!',
    })
    expect(messageSignature).toMatch(/^0x[0-9a-f]{130}$/i)

    const signedTransaction = await account.signTransaction({
      chainId: CHAIN_ID,
      type: 'eip1559',
      nonce: 0,
      gas: 21_000n,
      maxFeePerGas: 2_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
      to: account.address,
      value: 0n,
    })
    // Re-derive the signer from the RETURNED serialized bytes. This catches any
    // divergence between the serializer used to build the signing hash and the
    // one used for the returned encoding (see #383) — a plain hex-shape regex
    // (which also matches 0x0) would not.
    const recoveredSigner = await recoverTransactionAddress({
      serializedTransaction: signedTransaction as `0x02${string}`,
    })
    expect(recoveredSigner.toLowerCase()).toBe(account.address.toLowerCase())

    const typedDataSignature = await account.signTypedData({
      domain: {
        name: 'Doorway SDK staging test',
        version: '1',
        chainId: CHAIN_ID,
        verifyingContract: account.address,
      },
      types: {
        Audit: [{ name: 'statement', type: 'string' }],
      },
      primaryType: 'Audit',
      message: { statement: 'Verify every signing route' },
    })
    expect(typedDataSignature).toMatch(/^0x[0-9a-f]{130}$/i)

    const userOperationMessage = 'Doorway SDK staging user operation'
    const userOperationPayload = `\x19Ethereum Signed Message:\n${new TextEncoder().encode(userOperationMessage).length}${userOperationMessage}`
    const userOperationSignature = await client.signUserOperation({
      organizationId: session.organizationId,
      projectId,
      token: sessionToken,
      address: account.address,
      unsignedUserOperation: Buffer.from(userOperationPayload).toString('hex'),
      chainId: CHAIN_ID,
      encoding: 'hex',
    })
    expect(userOperationSignature).toMatch(/^0x[0-9a-f]{130}$/i)

    if (!account.signAuthorization) {
      throw new Error('Expected account to support EIP-7702 authorization')
    }
    const authorization = await account.signAuthorization({
      contractAddress: account.address,
      chainId: CHAIN_ID,
      nonce: 0,
    })
    expect(authorization.address).toBe(account.address)
    expect(authorization.chainId).toBe(CHAIN_ID)
  })
})
