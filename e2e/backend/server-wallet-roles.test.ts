/**
 * Backend E2E for Server Wallets agent-key ROLES, against the deployed KMS.
 *
 * Every refusal is explicitly identified through `mustRefuse`.
 * The suite includes positive controls as base proving each key is live and each
 * route is healthy.
 *
 * Needs three single-role agent keys alongside the main one. They cover the role model
 * the dashboard exposes when creating an agent key.
 */

import {
  concat,
  type Hex,
  hashMessage,
  hashTypedData,
  keccak256,
  numberToHex,
  serializeTransaction,
  toRlp,
} from 'viem'
import { hashAuthorization } from 'viem/utils'
import { describe, expect, it } from 'vitest'
import {
  createServerWalletClient,
  generateP256KeyPair,
} from '../../packages/core/src/server/index.js'
import {
  expectRecoversTo,
  refusal,
  roleKeys,
  serverWalletEnv,
} from '../helpers/server-wallet.js'

const CHAIN_ID = 421614
/** Error returned when the wrong-role is used */
const WRONG_ROLE = { status: 403, code: 'forbidden' } as const

describe('Server Wallets · agent key roles', () => {
  const { organizationId, projectId, address, walletId, origin, proxyBaseUrl } =
    serverWalletEnv()
  const keys = roleKeys()

  const clientFor = (role: keyof ReturnType<typeof roleKeys>) =>
    createServerWalletClient({
      organizationId,
      privateKey: keys[role],
      proxyBaseUrl,
      fetchOptions: { headers: { Origin: origin } },
    })

  /**
   * Require the exact KMS refusal for each attempted action. A successful call,
   * local signing error, project ACL failure, or 5xx backend failure cannot
   * prove the role boundary. Check status and code so an unknown or revoked key,
   * rate limit, or changed route cannot pass as a role denial. The unregistered
   * key control expects 401 unauthorized; wrong-role attempts expect 403 forbidden.
   */
  const mustRefuse = async (
    what: string,
    expected: { status: number; code: string },
    attempt: () => Promise<unknown>,
  ) => {
    let refused: ReturnType<typeof refusal> | undefined
    try {
      await attempt()
    } catch (error) {
      refused = refusal(error)
    }
    // Outside the catch, so an acceptance cannot be swallowed by this function's throw.
    if (!refused) {
      throw new Error(`${what} was ACCEPTED, so the role boundary did not hold`)
    }
    if (!refused.reachedServer) {
      throw new Error(`${what} never reached the KMS: ${refused.summary}`)
    }
    if (refused.status !== undefined && refused.status >= 500) {
      throw new Error(
        `${what} was refused ${refused.status}, which is not a role refusal — on the ` +
          `create route this is a backend limit. ${refused.summary}`,
      )
    }
    if (!refused.code) {
      throw new Error(
        `${what} was refused with no error code, so it cannot be attributed: ${refused.summary}`,
      )
    }
    if (/acl check failed/i.test(refused.message)) {
      throw new Error(
        `${what} was refused by the project ACL, not the role check. Point ZD_SW_ORIGIN at an allowlisted origin.`,
      )
    }
    if (refused.status !== expected.status || refused.code !== expected.code) {
      throw new Error(
        `${what} was refused ${refused.status} ${refused.code}, not the ${expected.status} ` +
          `${expected.code} this boundary answers. A rate limit, a revoked key or a ` +
          `changed route all land here. ${refused.summary}`,
      )
    }
    return refused
  }

  const MESSAGE = 'role sign-route control'

  const UNSIGNED_TX = serializeTransaction({
    chainId: CHAIN_ID,
    to: '0x0000000000000000000000000000000000000001',
    value: 0n,
    nonce: 0,
    gas: 21_000n,
    maxFeePerGas: 1_000_000_000n,
    maxPriorityFeePerGas: 1_000_000_000n,
    type: 'eip1559',
  })

  const TYPED_DATA = {
    domain: { name: 'RoleCheck', version: '1', chainId: CHAIN_ID },
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
      ],
      Check: [{ name: 'from', type: 'address' }],
    },
    primaryType: 'Check',
    message: { from: address },
  } as const
  const TYPED_DATA_HASH = hashTypedData(
    TYPED_DATA as Parameters<typeof hashTypedData>[0],
  )

  const DELEGATE = '0x0000000000000000000000000000000000007702' as Hex
  const AUTHORIZATION = { address: DELEGATE, chainId: CHAIN_ID, nonce: 0 }
  const UNSIGNED_AUTHORIZATION = concat([
    '0x05',
    toRlp([numberToHex(CHAIN_ID), DELEGATE, '0x']),
  ]).slice(2)
  const AUTHORIZATION_HASH = hashAuthorization(AUTHORIZATION)

  type RoleClient = ReturnType<typeof clientFor>

  const SIGN_ROUTES: {
    action: string
    hash: Hex
    run: (client: RoleClient) => Promise<Hex>
  }[] = [
    {
      action: 'signMessage',
      hash: hashMessage(MESSAGE),
      run: (c) =>
        c.signMessage({
          organizationId,
          projectId,
          address,
          message: MESSAGE,
          encoding: 'utf8',
        }),
    },
    {
      action: 'signTransaction',
      hash: keccak256(UNSIGNED_TX),
      run: (c) =>
        c.signTransaction({
          organizationId,
          projectId,
          address,
          unsignedTransaction: UNSIGNED_TX.slice(2),
        }),
    },
    {
      action: 'signTypedDataV4',
      hash: TYPED_DATA_HASH,
      run: (c) =>
        c.signTypedDataV4({
          organizationId,
          projectId,
          address,
          unsignedTypedDataV4: JSON.stringify(TYPED_DATA),
          encoding: 'utf8',
          typedDataHash: TYPED_DATA_HASH.slice(2),
        }),
    },
    {
      action: 'sign7702Authorization',
      hash: AUTHORIZATION_HASH,
      run: (c) =>
        c.sign7702Authorization({
          organizationId,
          projectId,
          address,
          unsignedTransaction: UNSIGNED_AUTHORIZATION,
          hashedAuthorization: AUTHORIZATION_HASH.slice(2),
        }),
    },
  ]

  /**
   * One control per sign route. Each proves the sign key is live, registered and
   * unexpired and that the route is healthy for this deployment.
   */
  it.each(SIGN_ROUTES)(
    'lets a sign-role key reach $action',
    async ({ run, hash }) => {
      const signature = await run(clientFor('sign'))
      await expectRecoversTo(hash, signature, address)
    },
  )

  /**
   * The create-role control using a derived ADDRESS rather than creating a wallet.
   */
  it('lets a create-role key reach the create route', async () => {
    const index = Math.floor(Math.random() * 2 ** 31)
    const path = `m/44'/60'/0'/0/${index}`

    let derived: Awaited<
      ReturnType<ReturnType<typeof clientFor>['createServerWalletAddress']>
    >
    try {
      derived = await clientFor('create').createServerWalletAddress({
        projectId,
        walletId,
        path,
      })
    } catch (error) {
      const refused = refusal(error)
      if (refused.status === 409) {
        throw new Error(
          `index ${index} was already on wallet ${walletId}, which is this control ` +
            `picking a taken index rather than the create role failing. Re-run. ${refused.summary}`,
        )
      }
      throw error
    }

    expect(derived.walletAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
    expect(derived.turnkeyId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    expect(derived.path).toBe(path)
  })

  /**
   * SKIPPED because we're limited to creating 100 wallets per wallet set and there is no
   * proper cleanup mechanism as of now.
   */
  it.skip('creates a wallet with a create-role key — SKIPPED: spends 1 of the sub-org’s 100 wallets and there is no teardown', async () => {
    const created = await clientFor('create').createServerWallet({ projectId })

    expect(created.walletId).toBeTruthy()
    expect(created.walletAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })

  it('refuses a create attempt from a sign-only key', async () => {
    await mustRefuse('create with a sign-only key', WRONG_ROLE, () =>
      clientFor('sign').createServerWallet({ projectId }),
    )
  })

  /**
   * Same as the control tests with the different.
   * Drives the same table the controls drove, so the only difference between a control
   * that signed and an attempt refused is the key.
   */
  it('refuses a create-only key on all four sign routes, identically', async () => {
    const client = clientFor('create')

    const outcomes: {
      action: string
      status: number | undefined
      code: string | undefined
    }[] = []
    const broken: string[] = []
    for (const { action, run } of SIGN_ROUTES) {
      try {
        const refused = await mustRefuse(
          `${action} with a create-only key`,
          WRONG_ROLE,
          () => run(client),
        )
        outcomes.push({
          action,
          status: refused.status,
          code: refused.code,
        })
      } catch (error) {
        broken.push(
          `${action}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
    if (broken.length > 0) throw new Error(broken.join(' · '))

    const shapes = new Set(outcomes.map((o) => `${o.status} ${o.code}`))
    expect(
      shapes.size,
      `the four sign routes refuse a create-only key differently: ${outcomes
        .map((o) => `${o.action} ${o.status} ${o.code}`)
        .join(' · ')}`,
    ).toBe(1)
  })

  it('refuses a read-only key on both create and sign', async () => {
    const client = clientFor('read')

    await mustRefuse('create with a read-only key', WRONG_ROLE, () =>
      client.createServerWallet({ projectId }),
    )
    await mustRefuse('sign with a read-only key', WRONG_ROLE, () =>
      client.signMessage({
        organizationId,
        projectId,
        address,
        message: 'should be refused',
        encoding: 'utf8',
      }),
    )
  })

  it('tells a wrong role apart from an unknown key', async () => {
    const stranger = createServerWalletClient({
      organizationId,
      privateKey: generateP256KeyPair().privateKey,
      proxyBaseUrl,
      fetchOptions: { headers: { Origin: origin } },
    })

    const unknown = await mustRefuse(
      'create with an unregistered key',
      { status: 401, code: 'unauthorized' },
      () => stranger.createServerWallet({ projectId }),
    )
    const wrongRole = await mustRefuse(
      'create with a sign-only key',
      WRONG_ROLE,
      () => clientFor('sign').createServerWallet({ projectId }),
    )

    expect(`${unknown.status} ${unknown.code}`).not.toBe(
      `${wrongRole.status} ${wrongRole.code}`,
    )
  })
})
