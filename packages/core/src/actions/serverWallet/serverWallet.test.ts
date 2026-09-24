import { createPublicKey, createVerify, ECDH } from 'node:crypto'
import { canonicalizeEx } from 'json-canonicalize'
import { type Hex, hashMessage, keccak256, toHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Client } from '../../client/types.js'
import { createPrivateKeyStamper } from '../../stampers/privateKeyStamper.js'
import type { SigningStamper, Stamp } from '../../stampers/types.js'
import type { TurnkeyPayload } from '../wallet/signingUtils.js'
import { createServerWallet } from './createServerWallet.js'
import { signMessage } from './signMessage.js'
import { signTransaction } from './signTransaction.js'
import { signTypedDataV4 } from './signTypedDataV4.js'
import { signUserOperation } from './signUserOperation.js'

const NOW = 1_700_000_000_000
const WALLET = { walletId: 'wallet', walletAddress: `0x${'11'.repeat(20)}` }
// P-256 test key from RFC 6979, appendix A.2.5, and its published compressed public key.
const TEST_PRIVATE_KEY =
  'c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721'
const TEST_PUBLIC_KEY =
  '0360fed4ba255a9d31c961eb74c6356d68c049b8923b61fa6ce669622e60f29fb6'

/** Stamps by echoing the payload so tests can read back exactly what was signed. */
function echoStamper(): SigningStamper {
  return {
    stamp: vi.fn(async (payload: string) => ({
      stampHeaderName: 'X-Stamp',
      stampHeaderValue: `signed:${payload}`,
    })),
  } as unknown as SigningStamper
}

function fakeClient(
  stamper: SigningStamper,
  options: { organizationId?: string; response?: unknown } = {},
) {
  const request = vi.fn(async () => options.response ?? {})
  const client = {
    apiKeyStamper: stamper,
    request,
    organizationId: options.organizationId,
  } as unknown as Client<undefined, SigningStamper>
  return { client, request }
}

function firstCall<Body>(request: ReturnType<typeof vi.fn>) {
  return request.mock.calls[0]![0] as unknown as {
    path: string
    method: string
    body: Body
    headers: Record<string, string>
  }
}

/** The Turnkey activity the KMS rebuilds in `turnkey.CreateWalletPayload`. */
function createWalletActivity(organizationId: string, timestampMs: number) {
  return {
    organizationId,
    parameters: {
      accounts: [
        {
          addressFormat: 'ADDRESS_FORMAT_ETHEREUM',
          curve: 'CURVE_SECP256K1',
          path: "m/44'/60'/0'/0/0",
          pathFormat: 'PATH_FORMAT_BIP32',
        },
      ],
      walletName: `default wallet-${timestampMs}`,
    },
    timestampMs: String(timestampMs),
    type: 'ACTIVITY_TYPE_CREATE_WALLET',
  }
}

/**
 * Mirrors `stampcheck.VerifyAPIKeyStamp` from the point the KMS holds a
 * canonical body: decode the envelope, decompress the key, sha256 the bytes,
 * check the DER signature. Callers pass the canonicalized body.
 */
function verifyLikeKms(stampHeaderValue: string, payload: string) {
  const envelope = JSON.parse(
    Buffer.from(stampHeaderValue, 'base64url').toString(),
  ) as { publicKey: string; scheme: string; signature: string }
  const point = Buffer.from(
    ECDH.convertKey(
      envelope.publicKey,
      'prime256v1',
      'hex',
      'hex',
      'uncompressed',
    ) as string,
    'hex',
  )
  const key = createPublicKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: point.subarray(1, 33).toString('base64url'),
      y: point.subarray(33).toString('base64url'),
    },
    format: 'jwk',
  })
  const verified = createVerify('SHA256')
    .update(payload)
    .verify(key, envelope.signature, 'hex')
  return { envelope, verified }
}

type CreateWalletBody = { timestampMs: number; stamp: Stamp }

describe('createServerWallet', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('produces two stamps the KMS verifier accepts over the bytes it hashes', async () => {
    const { client, request } = fakeClient(
      createPrivateKeyStamper(TEST_PRIVATE_KEY),
      { response: WALLET },
    )

    await createServerWallet(client, {
      projectId: 'project',
      organizationId: 'org',
    })

    const call = firstCall<CreateWalletBody>(request)
    const outer = verifyLikeKms(
      call.headers['X-Agent-Stamp']!,
      canonicalizeEx(call.body),
    )
    const inner = verifyLikeKms(
      call.body.stamp.stampHeaderValue,
      canonicalizeEx(createWalletActivity('org', call.body.timestampMs)),
    )
    expect(outer.verified).toBe(true)
    expect(outer.envelope.publicKey).toBe(TEST_PUBLIC_KEY)
    expect(inner.verified).toBe(true)
    expect(inner.envelope.publicKey).toBe(TEST_PUBLIC_KEY)
  })

  it('signs the CREATE_WALLET activity the KMS rebuilds, then posts the stamps where the KMS reads them', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const stamper = echoStamper()
    const { client, request } = fakeClient(stamper, { response: WALLET })

    await expect(
      createServerWallet(client, {
        projectId: 'project',
        organizationId: 'org',
      }),
    ).resolves.toEqual(WALLET)

    // What was signed: the inner stamp covers the activity the KMS rebuilds
    // from `timestampMs`, the outer stamp covers the body as sent.
    const call = firstCall<CreateWalletBody>(request)
    const activity = canonicalizeEx(createWalletActivity('org', NOW))
    const [innerPayload, outerPayload] = vi
      .mocked(stamper.stamp)
      .mock.calls.map(([payload]) => payload)
    expect(innerPayload).toBe(activity)
    expect(outerPayload).toBe(canonicalizeEx(call.body))

    // Where each stamp landed: inner in the body, outer in the agent header.
    expect(call.path).toBe('project/server-wallet/wallets')
    expect(call.method).toBe('POST')
    expect(call.body).toEqual({
      timestampMs: NOW,
      stamp: {
        stampHeaderName: 'X-Stamp',
        stampHeaderValue: `signed:${activity}`,
      },
    })
    expect(call.headers).toEqual({
      'X-Agent-Stamp': `signed:${outerPayload}`,
    })
  })

  it('falls back to the client organizationId', async () => {
    const stamper = echoStamper()
    const { client } = fakeClient(stamper, { organizationId: 'client-org' })

    await createServerWallet(client, { projectId: 'project' })

    const [innerPayload] = vi.mocked(stamper.stamp).mock.calls[0]!
    expect(JSON.parse(innerPayload).organizationId).toBe('client-org')
  })

  it('prefers the organizationId in params over the client one', async () => {
    const stamper = echoStamper()
    const { client } = fakeClient(stamper, { organizationId: 'client-org' })

    await createServerWallet(client, {
      projectId: 'project',
      organizationId: 'params-org',
    })

    const [innerPayload] = vi.mocked(stamper.stamp).mock.calls[0]!
    expect(JSON.parse(innerPayload).organizationId).toBe('params-org')
  })

  it('embeds the inner stamp under X-Stamp whatever the stamper names its header', async () => {
    // A custom SigningStamper (HSM, cloud KMS) may name its header anything.
    // The KMS validates the embedded name as X-Stamp and rejects others.
    const stamper = {
      stamp: async (payload: string) => ({
        stampHeaderName: 'X-Agent-Stamp',
        stampHeaderValue: `signed:${payload}`,
      }),
    } as unknown as SigningStamper
    const { client, request } = fakeClient(stamper)

    await createServerWallet(client, {
      projectId: 'project',
      organizationId: 'org',
    })

    expect(
      firstCall<CreateWalletBody>(request).body.stamp.stampHeaderName,
    ).toBe('X-Stamp')
  })

  it('throws before stamping when no organizationId is available', async () => {
    const stamper = echoStamper()
    const { client, request } = fakeClient(stamper)

    await expect(
      createServerWallet(client, { projectId: 'project' }),
    ).rejects.toThrow('createServerWallet needs an organizationId')
    expect(stamper.stamp).not.toHaveBeenCalled()
    expect(request).not.toHaveBeenCalled()
  })
})

type SignBody = Record<string, unknown> & { turnkeyPayload: TurnkeyPayload }

type SignCase = {
  name: string
  route: string
  run: (client: Client<undefined, SigningStamper>) => Promise<Hex>
  /** What the wallet signs; the test signs it as the owner so the response passes recovery. */
  hash: Hex
  bodyFields: Record<string, unknown>
}

describe('server wallet sign actions', () => {
  const owner = privateKeyToAccount(`0x${'11'.repeat(32)}`)
  const base = {
    organizationId: 'org',
    projectId: 'project',
    address: owner.address,
  }
  const tx = 'f86c808504a817c80082520894'
  const typedData = '{"domain":{"chainId":"1"},"types":{}}'
  const typedDataHash = keccak256(toHex(typedData))
  const userOpHash = keccak256(toHex('user operation'))
  // What the KMS requires on the wire: the hash wrapped as an EIP-191 personal
  // message, "\x19Ethereum Signed Message:\n32" followed by the 32 hash bytes.
  const wrappedUserOp =
    toHex('\x19Ethereum Signed Message:\n32').slice(2) + userOpHash.slice(2)

  const cases: SignCase[] = [
    {
      name: 'signMessage',
      route: 'message',
      run: (client) =>
        signMessage(client, { ...base, message: 'hello', encoding: 'utf8' }),
      hash: hashMessage('hello'),
      bodyFields: { message: 'hello', encoding: 'utf8' },
    },
    {
      name: 'signTransaction',
      route: 'transaction',
      run: (client) =>
        signTransaction(client, { ...base, unsignedTransaction: tx }),
      hash: keccak256(`0x${tx}`),
      bodyFields: { unsignedTransaction: tx },
    },
    {
      name: 'signTypedDataV4',
      route: 'typed-data-v4',
      run: (client) =>
        signTypedDataV4(client, {
          ...base,
          unsignedTypedDataV4: typedData,
          encoding: 'utf8',
          typedDataHash: typedDataHash.slice(2),
        }),
      hash: typedDataHash,
      bodyFields: { unsignedTypedDataV4: typedData, encoding: 'utf8' },
    },
    {
      name: 'signUserOperation',
      route: 'user-operation',
      run: (client) =>
        signUserOperation(client, { ...base, userOpHash, chainId: 421614 }),
      // The wallet signs keccak256 of the wrapped bytes, which is what viem's
      // hashMessage({ raw }) computes and what Kernel's validator recovers.
      hash: hashMessage({ raw: userOpHash }),
      bodyFields: {
        unsignedUserOperation: wrappedUserOp,
        chainId: 421614,
        encoding: 'hex',
      },
    },
  ]

  it.each(cases)(
    '$name posts to the agent route with no session and returns the signature',
    async ({ route, run, hash, bodyFields }) => {
      const signature = await owner.sign({ hash })
      const { client, request } = fakeClient(echoStamper(), {
        response: { signature },
      })

      await expect(run(client)).resolves.toBe(signature)

      const call = firstCall<SignBody>(request)
      expect(call.path).toBe(`project/server-wallet/sign/${route}`)
      expect(call.method).toBe('POST')
      expect(call.headers).toEqual({
        'X-Agent-Stamp': `signed:${canonicalizeEx(call.body)}`,
      })
      expect(call.body).toEqual({
        ...bodyFields,
        turnkeyPayload: {
          type: 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2',
          timestampMs: expect.any(String),
          organizationId: 'org',
          parameters: {
            signWith: owner.address,
            payload: hash.slice(2),
            encoding: 'PAYLOAD_ENCODING_HEXADECIMAL',
            hashFunction: 'HASH_FUNCTION_NO_OP',
          },
        },
        stampHeader: {
          stampHeaderName: 'X-Stamp',
          stampHeaderValue: `signed:${canonicalizeEx(call.body.turnkeyPayload)}`,
        },
      })
    },
  )
})
