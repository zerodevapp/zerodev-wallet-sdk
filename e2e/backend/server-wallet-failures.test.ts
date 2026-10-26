/**
 * Backend E2E for Server Wallets failure paths, against the deployed KMS.
 *
 * Every case asserts a specific refusal and not that an error was thrown.
 */

import { describe, expect, it } from 'vitest'
import {
  createServerWalletClient,
  generateP256KeyPair,
} from '../../packages/core/src/server/index.js'
import {
  createServerWalletClients,
  refusal,
  serverWalletEnv,
} from '../helpers/server-wallet.js'

describe('Server Wallets · failure paths', () => {
  const { client } = createServerWalletClients()
  const {
    organizationId,
    projectId,
    agentPrivateKey,
    address,
    origin,
    proxyBaseUrl,
  } = serverWalletEnv()

  const shared = {
    organizationId,
    ...(proxyBaseUrl && { proxyBaseUrl }),
    fetchOptions: { headers: { Origin: origin } },
  }

  it('refuses a well-formed but unregistered key as a credential problem', async () => {
    const stranger = createServerWalletClient({
      ...shared,
      privateKey: generateP256KeyPair().privateKey,
    })

    let refused: ReturnType<typeof refusal> | undefined
    try {
      await stranger.createServerWallet({ projectId })
    } catch (error) {
      refused = refusal(error)
    }

    if (!refused) throw new Error('an unregistered key was accepted')
    expect(refused.reachedServer).toBe(true)
    expect(refused.status).toBe(401)
  })

  it('reports an unreachable host as a transport failure, not a signing one', async () => {
    const unreachable = createServerWalletClient({
      ...shared,
      privateKey: agentPrivateKey,
      proxyBaseUrl: 'https://127.0.0.1:9/api/v1',
    })

    let refused: ReturnType<typeof refusal> | undefined
    try {
      await unreachable.createServerWallet({ projectId })
    } catch (error) {
      refused = refusal(error)
    }

    if (!refused) throw new Error('a call to an unreachable host succeeded')
    expect(refused.reachedServer).toBe(false)
    expect(refused.message).not.toMatch(/signature|stamp/i)
  })

  it('refuses signing for an address that does not exist', async () => {
    let refused: ReturnType<typeof refusal> | undefined
    try {
      await client.signMessage({
        organizationId,
        projectId,
        address: '0x00000000000000000000000000000000DeaDBeef',
        message: 'should be refused',
        encoding: 'utf8',
      })
    } catch (error) {
      refused = refusal(error)
    }

    if (!refused) {
      throw new Error('signing for a nonexistent address was accepted')
    }
    expect(refused.reachedServer).toBe(true)
    expect(refused.status).toBe(500)
    expect(refused.code).toBe('external_service_error')
  })

  it('stays usable after a refusal', async () => {
    let refused: ReturnType<typeof refusal> | undefined
    try {
      await client.signMessage({
        organizationId,
        projectId,
        address: '0x000000000000000000000000000000000000dEaD',
        message: 'should be refused',
        encoding: 'utf8',
      })
    } catch (error) {
      refused = refusal(error)
    }

    if (!refused) throw new Error('signing for a foreign address was accepted')
    expect(refused.reachedServer).toBe(true)
    expect(refused.status).toBe(500)
    expect(refused.code).toBe('external_service_error')

    const message = `after the refusal ${new Date().toISOString()}`
    const signature = await client.signMessage({
      organizationId,
      projectId,
      address,
      message,
      encoding: 'utf8',
    })
    expect(signature).toMatch(/^0x[0-9a-f]{130}$/i)
  })

  /**
   * BIP-32 specifies that the usable index belongs is smaller than 2^31 - 1 so we make
   * sure the backend gates for that limit.
   */
  it('refuses a path index past the non-hardened range', async () => {
    let refused: ReturnType<typeof refusal> | undefined
    try {
      await client.createServerWalletAddress({
        projectId,
        walletId: serverWalletEnv().walletId,
        path: `m/44'/60'/0'/0/${2 ** 31}`,
      })
    } catch (error) {
      refused = refusal(error)
    }

    if (!refused) {
      throw new Error('an index past the non-hardened range was accepted')
    }
    expect(refused.reachedServer).toBe(true)
    expect(refused.status).toBe(500)
    expect(refused.code).toBe('external_service_error')
  })

  /**
   * Longer than the transport's 10s AbortController, so it proves the client is not
   * holding a connection the timeout kills.
   */
  it(
    'signs after an idle gap longer than the request timeout',
    { timeout: 60_000 },
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 15_000))

      const message = `after 15s idle ${new Date().toISOString()}`
      const signature = await client.signMessage({
        organizationId,
        projectId,
        address,
        message,
        encoding: 'utf8',
      })
      expect(signature).toMatch(/^0x[0-9a-f]{130}$/i)
    },
  )
})
