/**
 * Boundary: Wallet Core <-> KMS, at `sign/7702-authorization` — the fourth
 * signing method on the account.
 *
 * `signAuthorization` builds the EIP-7702 pre-image by hand while hashing the
 * same authorization with viem's `hashAuthorization`, then returns a tuple
 * assembled from `parameters` rather than from what the signature covered — so
 * what Core signs can drift from what it reports, and the caller broadcasts the
 * report. `recoverAuthorizationAddress` recomputes the hash from the returned
 * tuple, which is why it is the assertion this file leans on.
 *
 * Seam is HEALTHY as probed; no `it.fails` here.
 */
import { type Hex, keccak256 } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { recoverAuthorizationAddress } from 'viem/utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createZeroDevWalletCore } from '../core/createZeroDevWalletCore.js'
import type { ApiKeyStamper, PasskeyStamper } from '../stampers/types.js'
import type { StorageAdapter } from '../storage/manager.js'
import { SessionType } from '../types/session.js'

/** Publicly known test keys; OWNER is the wallet's signer so recovery succeeds. */
const OWNER = privateKeyToAccount(`0x${'11'.repeat(32)}` as Hex)
const IMPOSTOR = privateKeyToAccount(`0x${'33'.repeat(32)}` as Hex)

/** The contract being delegated to — NOT the wallet. */
const DELEGATE = '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e' as Hex
const ZERO = '0x0000000000000000000000000000000000000000' as Hex

const sessionKey = (nth: number) => `02${String(nth).padStart(64, '0')}`

function keyStore(): ApiKeyStamper {
  let active: string | null = null
  let pending: string | null = null
  let minted = 0
  const stamp = async () => ({
    stampHeaderName: 'X-Stamp',
    stampHeaderValue: 'stamp',
  })
  return {
    stamp,
    clear: async () => {
      active = null
      pending = null
    },
    getPublicKey: async () => active,
    resetKeyPair: async () => {
      active = sessionKey(++minted)
    },
    prepareKeyRotation: async () => {
      pending = sessionKey(++minted)
      return pending
    },
    stampPending: stamp,
    signPending: async () => 'sig',
    commitKeyRotation: async () => {
      if (pending) active = pending
      pending = null
    },
    discardKeyRotation: async () => {
      pending = null
    },
    sign: async () => 'sig',
  }
}

const passkeyStamper: PasskeyStamper = {
  stamp: async () => ({
    stampHeaderName: 'X-Stamp',
    stampHeaderValue: 'stamp',
  }),
  clear: async () => {},
  register: async () => ({
    attestation: {
      attestationObject: 'ao',
      clientDataJson: 'cdj',
      credentialId: 'cred-1',
    },
    encodedChallenge: 'challenge',
  }),
}

function token(publicKey: string) {
  return `hdr.${btoa(
    JSON.stringify({
      exp: Date.now() + 3_600_000,
      public_key: publicKey,
      session_type: SessionType.READ_WRITE,
      user_id: 'user-1',
      organization_id: 'suborg-1',
    }),
  )}.sig`
}

/** What a `/sign/*` request is answered with. */
type Answer =
  | { signature: unknown }
  | { raw: string; contentType: string }
  | { status: number }

/** Body of a `sign/7702-authorization` request, as it went on the wire. */
type SigningRequest = {
  unsignedTransaction: string
  turnkeyPayload: { parameters: { signWith: string; payload: string } }
}

/**
 * The double signs whatever hash it is handed with `signer` rather than deciding
 * anything, so a degenerate case differs from the control only in `answer`.
 * `sent` collects the `/sign/` bodies so assertions can read what Core asked
 * for, not only what it returned.
 */
async function loggedIn(
  answer: (correct: Hex) => Answer,
  signer = OWNER,
): Promise<{
  signAuthorization: NonNullable<
    Awaited<ReturnType<typeof buildAccount>>['signAuthorization']
  >
  sent: SigningRequest[]
}> {
  const sent: SigningRequest[] = []
  const api = keyStore()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      const json = (payload: unknown, status = 200) =>
        new Response(JSON.stringify(payload), {
          status,
          headers: { 'content-type': 'application/json' },
        })

      if (path.includes('parent-org-id')) {
        return json({ parentOrgId: 'parent-org' })
      }
      if (path.includes('/auth/login/stamp')) {
        return json({ session: token(body.targetPublicKey) })
      }
      if (path.includes('/user-wallet')) {
        return json({ walletAddresses: [OWNER.address] })
      }
      if (path.includes('/sign/')) {
        sent.push(body as SigningRequest)
        const correct = await signer.sign({
          hash: `0x${body.turnkeyPayload.parameters.payload}` as Hex,
        })
        const chosen = answer(correct)
        if ('status' in chosen) {
          return json({ error: 'bad_token', message: 'expired' }, chosen.status)
        }
        if ('raw' in chosen) {
          return new Response(chosen.raw, {
            status: 200,
            headers: { 'content-type': chosen.contentType },
          })
        }
        return json(chosen)
      }
      return json({}, 404)
    }),
  )

  const account = await buildAccount(api)
  const signAuthorization = account.signAuthorization
  if (!signAuthorization) {
    throw new Error('account does not expose signAuthorization')
  }
  return { signAuthorization, sent }
}

async function buildAccount(api: ApiKeyStamper) {
  const store = new Map<string, string>()
  const adapter: StorageAdapter = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: (key) => {
      store.delete(key)
    },
  }
  const core = await createZeroDevWalletCore({
    projectId: 'proj',
    rpId: 'localhost',
    sessionStorage: adapter,
    apiKeyStamper: api,
    passkeyStamper,
    proxyBaseUrl: 'https://kms.test.invalid/api/v1',
  })
  await core.auth({ type: 'passkey', mode: 'login' })
  return core.toAccount()
}

const correctly = (correct: Hex) => ({ signature: correct })

/** A genuine OWNER signature, but over something Core never asked to have signed. */
const elsewhere = await OWNER.sign({ hash: keccak256('0xdeadbeef') })

/**
 * Attributable = the caller can tell the signing response was at fault. Rejects
 * a `TypeError` and a message that names nothing, so neither a raw deref nor a
 * bare `Error('failed')` can pass for a guard.
 */
function blamesTheSignature(error: unknown) {
  return (
    error instanceof Error &&
    !(error instanceof TypeError) &&
    /signature|signing/i.test(error.message)
  )
}

const caught = (p: Promise<unknown>) =>
  p.then(
    () => 'AUTHORIZED' as const,
    (error: unknown) => error,
  )

/**
 * Shape of the signature halves in the returned tuple, asserted alongside the
 * recovery rather than instead of it. `serializeAuthorizationList` RLP-encodes
 * `r`/`s`/`yParity` straight into the transaction, so a short or missing half
 * becomes a silently wrong authorization on the wire.
 */
function expectWellFormedSignature(authorization: {
  r?: Hex | undefined
  s?: Hex | undefined
  yParity?: number | undefined
}) {
  expect(authorization.r).toMatch(/^0x[0-9a-f]{64}$/i)
  expect(authorization.s).toMatch(/^0x[0-9a-f]{64}$/i)
  expect([0, 1]).toContain(authorization.yParity)
}

/** The pre-image Core told KMS it was hashing, and the hash it asked to be signed. */
const preimageOf = (request: SigningRequest) =>
  keccak256(`0x${request.unsignedTransaction}` as Hex)
const signedHashOf = (request: SigningRequest) =>
  `0x${request.turnkeyPayload.parameters.payload}`

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('7702: the authorization returned is the one that was signed', () => {
  // chainId and nonce each pass through a `x ? numberToHex(x) : '0x'` ternary,
  // so 0 takes the other branch. chainId 0 is not degenerate input — EIP-7702
  // defines it as valid on any chain, so signing 0 while reporting 1 hands out
  // a replayable delegation.
  const authorizations: [string, number, number][] = [
    ['a real chain and nonce', 1, 7],
    ['chain 0 — valid on any chain', 0, 7],
    ['nonce 0 — a never-delegated account', 1, 0],
    ['both zero', 0, 0],
  ]

  for (const [label, chainId, nonce] of authorizations) {
    it(`recovers to the wallet owner for ${label}`, async () => {
      const { signAuthorization } = await loggedIn(correctly)

      const authorization = await signAuthorization({
        address: DELEGATE,
        chainId,
        nonce,
      })

      // Recomputed from the returned tuple, so this fails if the delegate,
      // chain or nonce Core reports differs from the one it signed.
      await expect(
        recoverAuthorizationAddress({ authorization }),
      ).resolves.toBe(OWNER.address)
      expect(authorization).toMatchObject({ address: DELEGATE, chainId, nonce })
      expectWellFormedSignature(authorization)
    })

    it(`asks KMS to sign the pre-image it sends for ${label}`, async () => {
      const { signAuthorization, sent } = await loggedIn(correctly)

      await signAuthorization({ address: DELEGATE, chainId, nonce })

      // Nothing downstream compares the two, so this is the only guard against
      // the hand-built pre-image drifting from viem's `hashAuthorization`. The
      // `both zero` case cannot see a chainId/nonce transposition (identical at
      // 0); the other three can, hence the whole table.
      expect(preimageOf(sent[0])).toBe(signedHashOf(sent[0]))
    })
  }

  it('signs with the wallet address, not the delegation target', async () => {
    // Only one of the two addresses is the signer; swapping them would sign
    // with the delegation target.
    const { signAuthorization, sent } = await loggedIn(correctly)

    await signAuthorization({ address: DELEGATE, chainId: 1, nonce: 7 })

    expect(sent[0].turnkeyPayload.parameters.signWith).toBe(OWNER.address)
  })

  it('normalizes the contractAddress alias onto address', async () => {
    // `AuthorizationRequest` accepts either key, but
    // `serializeAuthorizationList` reads only `address` — so keeping the
    // caller's key verbatim would RLP-encode `undefined` as the delegate.
    const { signAuthorization } = await loggedIn(correctly)

    const authorization = await signAuthorization({
      contractAddress: DELEGATE,
      chainId: 1,
      nonce: 7,
    })

    expect(authorization.address).toBe(DELEGATE)
    await expect(recoverAuthorizationAddress({ authorization })).resolves.toBe(
      OWNER.address,
    )
    expectWellFormedSignature(authorization)
  })
})

describe('7702: authorizations Core must not refuse', () => {
  it('authorizes the zero address, which revokes a delegation', async () => {
    // The zero address clears a delegation, so this is how a user un-delegates.
    // `buildTurnkeyPayload` and `toViemAccount` both reject zero addresses for
    // the *wallet* — extending that to the delegation target would strand every
    // delegated user, so this test is here to stop it.
    const { signAuthorization } = await loggedIn(correctly)

    const authorization = await signAuthorization({
      address: ZERO,
      chainId: 1,
      nonce: 3,
    })

    expect(authorization.address).toBe(ZERO)
    await expect(recoverAuthorizationAddress({ authorization })).resolves.toBe(
      OWNER.address,
    )
    expectWellFormedSignature(authorization)
  })

  it('accepts a signature the backend sent without an 0x prefix', async () => {
    // `sendSigningRequest` normalizes it; dropping that would reject perfectly
    // good responses.
    const { signAuthorization } = await loggedIn((correct) => ({
      signature: correct.slice(2),
    }))

    const authorization = await signAuthorization({
      address: DELEGATE,
      chainId: 1,
      nonce: 7,
    })

    await expect(recoverAuthorizationAddress({ authorization })).resolves.toBe(
      OWNER.address,
    )
    expectWellFormedSignature(authorization)
  })
})

describe('7702: nothing to authorize', () => {
  it('refuses before spending a KMS round trip when no address was given', async () => {
    // Reachable only from untyped callers, but the observable is outbound: no
    // KMS round trip is spent signing an `undefined` delegation target.
    const { signAuthorization, sent } = await loggedIn(correctly)

    const error = await caught(
      signAuthorization({ chainId: 1, nonce: 7 } as never),
    )

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toMatch(/address is undefined/i)
    expect(sent).toHaveLength(0)
  })
})

describe('7702: the signing response is unusable', () => {
  // These share `sendSigningRequest` with `signingResponse.integration.test.ts`,
  // so no mutation kills them uniquely; they keep the 7702 endpoint covered if
  // the message path moves. Three guards hold the line, measured: the
  // `signature` field check (absent/null/non-string/non-JSON), the
  // `recoverAddress` call itself (malformed and truncated hex), and the two
  // ownership comparisons — which only the wrong-signer test needs, and needs
  // BOTH gone to fail. Do not "fix" either surviving mutation.

  const unusable: [string, (correct: Hex) => Answer][] = [
    ['the field is absent', () => ({}) as Answer],
    ['it is an empty string', () => ({ signature: '' })],
    ['it is null', () => ({ signature: null })],
    ['it is not a string', () => ({ signature: 42 })],
    ['it is not hex', () => ({ signature: `0x${'zz'.repeat(32)}` })],
    ['it is truncated', (correct) => ({ signature: correct.slice(0, 40) })],
    [
      'the body is not JSON at all',
      () => ({ raw: '<html>gateway timeout</html>', contentType: 'text/html' }),
    ],
  ]

  for (const [label, answer] of unusable) {
    it(`returns no authorization when ${label}`, async () => {
      const { signAuthorization } = await loggedIn(answer)

      const error = await caught(
        signAuthorization({ address: DELEGATE, chainId: 1, nonce: 7 }),
      )

      // Must reject, not resolve with the tuple minus its signature: viem
      // serializes a missing r/s as zeroes and the caller cannot tell.
      expect(blamesTheSignature(error)).toBe(true)
    })
  }

  it('refuses a valid signature made over a different authorization', async () => {
    // Right key, right length, wrong bytes signed — KMS returning a signature
    // over an authorization Core never asked for. For 7702 that is a delegation
    // to a contract the user did not choose, so no shape check is any use here.
    const { signAuthorization } = await loggedIn(() => ({
      signature: elsewhere,
    }))

    const error = await caught(
      signAuthorization({ address: DELEGATE, chainId: 1, nonce: 7 }),
    )

    expect(blamesTheSignature(error)).toBe(true)
  })

  it('refuses an authorization signed by someone other than the wallet', async () => {
    // Well-formed, over the right hash, wrong key. Broadcast, it delegates the
    // signer's account instead of the user's.
    const { signAuthorization } = await loggedIn(correctly, IMPOSTOR)

    const error = await caught(
      signAuthorization({ address: DELEGATE, chainId: 1, nonce: 7 }),
    )

    expect(blamesTheSignature(error)).toBe(true)
    expect((error as Error).message).toContain(OWNER.address)
  })

  it('surfaces a rejected token as a request failure, not a signature fault', async () => {
    const { signAuthorization } = await loggedIn(() => ({ status: 401 }))

    const error = await caught(
      signAuthorization({ address: DELEGATE, chainId: 1, nonce: 7 }),
    )

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('401')
  })
})
