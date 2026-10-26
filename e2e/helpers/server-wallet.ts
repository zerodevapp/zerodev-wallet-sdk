/**
 * Shared setup and assertions for Server Wallets backend e2e tests.
 */

import { type Hex, isAddressEqual, recoverAddress } from 'viem'
import { RestRequestError } from '../../packages/core/src/errors/request.js'
import {
  createServerWalletClient,
  createZeroDevServerWallet,
} from '../../packages/core/src/server/index.js'

/**
 * The wallet set, wallet and signing address must exist before the suite runs.
 * 
/** Required env, checked by `global-setup.ts`. */
export const REQUIRED_SERVER_WALLET_ENV = [
  'ZD_SW_ORGANIZATION_ID',
  'ZD_SW_PROJECT_ID',
  'ZD_SW_AGENT_PRIVATE_KEY',
  'ZD_SW_ADDRESS',
  'ZD_SW_WALLET_ID',
  'ZD_SW_ORIGIN',
  'ZD_SW_KEY_CREATE',
  'ZD_SW_KEY_SIGN',
  'ZD_SW_KEY_READ',
] as const

export const serverWalletEnv = () => {
  const env = {
    organizationId: process.env.ZD_SW_ORGANIZATION_ID,
    projectId: process.env.ZD_SW_PROJECT_ID,
    agentPrivateKey: process.env.ZD_SW_AGENT_PRIVATE_KEY,
    address: process.env.ZD_SW_ADDRESS,
    // Previously created wallet in an existing organizationId.
    walletId: process.env.ZD_SW_WALLET_ID,
    origin: process.env.ZD_SW_ORIGIN,
    proxyBaseUrl: process.env.ZD_SW_PROXY_BASE_URL,
  }
  const missing = (
    [
      'organizationId',
      'projectId',
      'agentPrivateKey',
      'address',
      'walletId',
      'origin',
    ] as const
  ).filter((key) => !env[key])
  if (missing.length > 0) {
    throw new Error(
      `server wallet e2e needs ZD_SW_* in .env, missing: ${missing.join(', ')}`,
    )
  }
  return {
    ...(env as { [K in keyof typeof env]: string }),
    address: env.address as Hex,
    proxyBaseUrl: env.proxyBaseUrl,
  }
}

/**
 * Build the agent client and facade with the same credentials and origin.
 */
export function createServerWalletClients() {
  const { organizationId, projectId, agentPrivateKey, origin, proxyBaseUrl } =
    serverWalletEnv()
  const shared = {
    organizationId,
    privateKey: agentPrivateKey,
    ...(proxyBaseUrl && { proxyBaseUrl }),
    fetchOptions: { headers: { Origin: origin } },
  }
  return {
    client: createServerWalletClient(shared),
    serverWallet: createZeroDevServerWallet({ ...shared, projectId }),
  }
}

/** Env names for the dashboard's three single-role agent keys. */
export const ROLE_KEY_ENV = {
  create: 'ZD_SW_KEY_CREATE',
  sign: 'ZD_SW_KEY_SIGN',
  read: 'ZD_SW_KEY_READ',
} as const

/**
 * Read and validate the single-role keys.
 *
 * Trim before validation and use. Validating a trimmed copy but returning the
 * raw value would let a trailing newline fail later in the curve library.
 */
export function roleKeys() {
  const entries = Object.entries(ROLE_KEY_ENV).map(([role, name]) => [
    role,
    (process.env[name] ?? '').trim(),
  ])
  const invalid = entries
    .filter(([, value]) => !/^(0x)?[0-9a-fA-F]{64}$/.test(value as string))
    .map(([role]) => ROLE_KEY_ENV[role as keyof typeof ROLE_KEY_ENV])
  if (invalid.length > 0) {
    throw new Error(
      `the role suite needs a 32-byte hex agent key in each of: ${invalid.join(', ')}`,
    )
  }
  return Object.fromEntries(entries) as Record<
    keyof typeof ROLE_KEY_ENV,
    string
  >
}

/**
 * Extract the status, error code and KMS request ID from a refusal.
 */
export function refusal(error: unknown) {
  if (error instanceof RestRequestError) {
    const body = error.body as
      | { error?: string; message?: string; id?: string }
      | undefined
    return {
      reachedServer: true,
      status: error.status,
      code: body?.error,
      id: body?.id,
      message: body?.message ?? error.message,
      summary: `${error.status} ${body?.error} · ${body?.message}${body?.id ? ` · id ${body.id}` : ''}`,
    }
  }
  return {
    reachedServer: false,
    status: undefined,
    code: undefined,
    id: undefined,
    message: error instanceof Error ? error.message : String(error),
    summary: `no response · ${error instanceof Error ? error.message : String(error)}`,
  }
}

/**
 * Require the expected HTTP status and KMS error code.
 *
 * A rate limit, revoked key, backend failure or transport failure also rejects
 * the promise. Status and code distinguish those from the refusal under test.
 * Transport failures and 5xx responses get specific error messages.
 */
export function expectRefusal(
  what: string,
  error: unknown,
  expected: { status: number; code: string },
) {
  const refused = refusal(error)
  if (!refused.reachedServer) {
    throw new Error(`${what} never reached the KMS: ${refused.summary}`)
  }
  if (refused.status !== undefined && refused.status >= 500) {
    throw new Error(
      `${what} was refused ${refused.status}, which is an outage or a backend limit, not ` +
        `the ${expected.status} ${expected.code} this case is about. ${refused.summary}`,
    )
  }
  if (refused.status !== expected.status || refused.code !== expected.code) {
    throw new Error(
      `${what} was refused ${refused.status} ${refused.code}, not the ${expected.status} ` +
        `${expected.code} it answers. A rate limit, a revoked key or a changed route all ` +
        `land here. ${refused.summary}`,
    )
  }
  return refused
}

/** Return the error from `fn`, or throw if `fn` succeeds. */
export async function rejection(fn: () => Promise<unknown>) {
  try {
    await fn()
  } catch (error) {
    return error
  }
  throw new Error('expected a refusal, but the call resolved')
}

/**
 * Require the signature to recover to `expected` over the caller's hash.
 *
 * `sendSigningRequest` verifies the signature against the hash it sent. Tests
 * recompute the hash from their input, so this check catches SDK hashing errors
 * that its own verification would accept.
 */
export async function expectRecoversTo(
  hash: Hex,
  signature: Hex,
  expected: Hex,
) {
  const recovered = await recoverAddress({ hash, signature })
  if (!isAddressEqual(recovered, expected)) {
    throw new Error(
      `signed, but over the wrong hash · sig ${signature} · recovered ${recovered}, expected ${expected}`,
    )
  }
  return recovered
}
