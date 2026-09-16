import { createBaseClient } from '../client/createClient.js'
import {
  type ServerWalletActions,
  serverWalletActions,
} from '../client/decorators/serverWallet.js'
import { zeroDevWalletTransport } from '../client/transports/createTransport.js'
import type { Client } from '../client/types.js'
import { KMS_SERVER_URL } from '../constants.js'
import { createAgentKeyStamper } from '../stampers/agentKeyStamper.js'
import { createNoopPasskeyStamper } from '../stampers/noopPasskeyStamper.js'
import type { SigningStamper } from '../stampers/types.js'

export type ServerWalletClient = Client<ServerWalletActions, SigningStamper>

/**
 * One of `privateKey` or `stamper` is required. `stamper` wins when both are
 * given: a key held in an HSM or a cloud KMS signs through its own stamper and
 * the raw key never enters the process.
 */
export type ServerWalletClientConfig = {
  /** The wallet set's sub-organization ID, returned when the wallet set was registered. */
  organizationId: string
} & (
  | {
      /** Agent private key, 32-byte hex. The client builds an agent-key stamper from it. */
      privateKey: string
      stamper?: SigningStamper
    }
  | {
      privateKey?: string
      /** Signs with the agent key. Any `SigningStamper`. */
      stamper: SigningStamper
    }
)

/**
 * A client for a server process holding an agent key. Same base client and
 * transport as the web client; only the stamper in the slot and the bound
 * actions differ. Owner and admin operations are not here: they belong to the
 * dashboard.
 */
export function createServerWalletClient(
  config: ServerWalletClientConfig,
): ServerWalletClient {
  const stamper = resolveStamper(config)
  return createBaseClient<undefined, SigningStamper>({
    transport: zeroDevWalletTransport({ baseUrl: `${KMS_SERVER_URL}/api/v1` }),
    apiKeyStamper: stamper,
    passkeyStamper: createNoopPasskeyStamper(),
    organizationId: config.organizationId,
    key: 'serverWallet',
    name: 'ZeroDev Server Wallet Client',
  }).extend(serverWalletActions) as ServerWalletClient
}

function resolveStamper(config: ServerWalletClientConfig): SigningStamper {
  if (config.stamper) return config.stamper
  if (config.privateKey) return createAgentKeyStamper(config.privateKey)
  throw new Error('createServerWalletClient: pass `privateKey` or `stamper`')
}
