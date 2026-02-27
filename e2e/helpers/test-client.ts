/**
 * Creates a test SDK client configured for integration tests.
 *
 * Sets up the transport with an Origin header to pass backend ACL checks,
 * and uses the TestStamper as the IndexedDB stamper.
 */

import { createClient } from '../../packages/core/src/client/createClient.js'
import { rest } from '../../packages/core/src/client/transports/rest.js'
import type { Transport } from '../../packages/core/src/client/types.js'
import type { IndexedDbStamper } from '../../packages/core/src/stampers/types.js'
import { BACKEND_URL } from './constants.js'

const noopStamper = {
  getPublicKey: async () => null,
  stamp: async () => ({ stampHeaderName: '', stampHeaderValue: '' }),
  clear: async () => {},
}

/**
 * Creates a transport that includes an Origin header for ACL checks.
 * The staging backend requires a valid Origin header matching the project's ACL.
 */
function testTransport(baseUrl: string): Transport {
  return ({ indexedDbStamper, webauthnStamper }) => {
    const transport = rest(baseUrl, {
      timeoutMs: 30_000,
      key: 'zeroDevWallet',
      name: 'ZeroDev Wallet Transport',
      indexedDbStamper,
      webauthnStamper,
      fetchOptions: {
        headers: {
          Origin: 'http://localhost:3000',
        },
      },
    })

    return {
      config: {
        name: 'ZeroDev Wallet Transport',
        key: 'zeroDevWallet',
        url: baseUrl,
        timeoutMs: 30_000,
        type: 'zeroDevWallet',
      },
      request: transport.request,
      value: {},
    }
  }
}

/**
 * Creates an SDK client configured for integration tests.
 * Includes Origin header for ACL checks and uses the provided stamper.
 */
export function createTestClient(
  stamper: IndexedDbStamper,
  baseUrl = BACKEND_URL,
) {
  return createClient({
    transport: testTransport(baseUrl),
    indexedDbStamper: stamper,
    webauthnStamper: noopStamper,
  })
}
