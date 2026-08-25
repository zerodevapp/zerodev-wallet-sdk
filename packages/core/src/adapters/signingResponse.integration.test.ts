/**
 * Boundary: Wallet Core <-> KMS, at the point a signing response becomes a
 * signature the caller will broadcast.
 *
 * Three endpoints share `sendSigningRequest`, which requires a non-empty
 * `signature` string, prefixes `0x` when the backend omits it, and recovers the
 * signer against the payload it asked to have signed; `toViemAccount`'s
 * `assertOwner` recovers a second time, so the owner check is redundant by
 * design. `loginWalletIdentity` covers a well-formed signature from the wrong
 * wallet, so this file covers responses carrying no usable signature at all.
 *
 * Seam is HEALTHY as probed; no `it.fails` here.
 */
import {
  type Hex,
  keccak256,
  parseGwei,
  recoverMessageAddress,
  recoverTransactionAddress,
  recoverTypedDataAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createZeroDevWalletCore } from '../core/createZeroDevWalletCore.js'
import type { ApiKeyStamper, PasskeyStamper } from '../stampers/types.js'
import type { StorageAdapter } from '../storage/manager.js'
import { SessionType } from '../types/session.js'

/** Publicly known test keys; the wallet's signer, so recovery can succeed. */
const OWNER = privateKeyToAccount(`0x${'11'.repeat(32)}` as Hex)
const PAYEE = privateKeyToAccount(`0x${'22'.repeat(32)}` as Hex)

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

/**
 * The double signs whatever hash it is handed with the wallet's key rather than
 * deciding anything, so a degenerate case differs from the control only in
 * `answer`.
 */
async function loggedIn(answer: (correct: Hex) => Answer) {
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
        const correct = await OWNER.sign({
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
    () => 'SIGNED' as const,
    (error: unknown) => error,
  )

/** 65 bytes exactly. Asserted alongside every recovery, never instead of one. */
const SIGNATURE = /^0x[0-9a-f]{130}$/i

const TYPED_DATA = {
  domain: { name: 'Test', version: '1', chainId: 1 },
  types: { Msg: [{ name: 'x', type: 'uint256' }] },
  primaryType: 'Msg',
  message: { x: 1n },
} as const

const TRANSACTION = {
  chainId: 1,
  to: PAYEE.address,
  value: 0n,
  nonce: 0,
  gas: 21_000n,
  maxFeePerGas: parseGwei('1'),
  maxPriorityFeePerGas: parseGwei('1'),
  type: 'eip1559',
} as never

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('signing: all three endpoints return a usable signature', () => {
  // Shape AND recovery, on the value the CALLER received. Recovery is what
  // catches 130 zeroes, a different payload, or a signature mangled after
  // `assertOwner` already ran; shape localises the failure. Keep both.
  it('signs a message', async () => {
    const account = await loggedIn(correctly)

    const signature = await account.signMessage({ message: 'hello' })

    expect(signature).toMatch(SIGNATURE)
    await expect(
      recoverMessageAddress({ message: 'hello', signature }),
    ).resolves.toBe(OWNER.address)
  })

  it('signs typed data', async () => {
    const account = await loggedIn(correctly)

    const signature = await account.signTypedData(TYPED_DATA as never)

    expect(signature).toMatch(SIGNATURE)
    await expect(
      recoverTypedDataAddress({ ...TYPED_DATA, signature } as never),
    ).resolves.toBe(OWNER.address)
  })

  it('signs a transaction', async () => {
    // Returns a serialized transaction, not a raw signature — the adapter
    // re-serializes with the recovered r/s/v. Prefix asserts it is still
    // eip1559; recovery asserts the signature survived that round trip.
    const account = await loggedIn(correctly)

    const serializedTransaction = await account.signTransaction(TRANSACTION)

    expect(serializedTransaction).toMatch(/^0x02[0-9a-f]+$/i)
    await expect(
      recoverTransactionAddress({
        serializedTransaction: serializedTransaction as `0x02${string}`,
      }),
    ).resolves.toBe(OWNER.address)
  })
})

describe('signing: the response carries no usable signature', () => {
  const shapes: [string, Answer][] = [
    ['the field is absent', {} as Answer],
    ['it is an empty string', { signature: '' }],
    ['it is null', { signature: null }],
    ['it is not a string', { signature: 42 }],
  ]

  for (const [label, response] of shapes) {
    it(`refuses to return a signature when ${label}`, async () => {
      const account = await loggedIn(() => response)

      const error = await caught(account.signMessage({ message: 'hello' }))

      expect(blamesTheSignature(error)).toBe(true)
    })
  }

  it('guards the non-JSON body that the oauth branch does not', async () => {
    // `rest.ts` hands a non-JSON 200 back as `data`. Here the `signature` field
    // check catches it; `auth({type:'oauth'})` reports the same body as a
    // legitimate sessionless login. That asymmetry is the oauth defect's case.
    const account = await loggedIn(() => ({
      raw: '<html>gateway timeout</html>',
      contentType: 'text/html',
    }))

    const error = await caught(account.signMessage({ message: 'hello' }))

    expect(blamesTheSignature(error)).toBe(true)
  })
})

describe('signing: the signature is present but unusable', () => {
  // Measured, so nobody prunes the wrong thing: malformed and truncated hex are
  // caught by the `recoverAddress` CALL itself and stay green even with both
  // ownership comparisons deleted. Only the different-payload test below needs
  // those comparisons, and needs BOTH gone to fail. Do not "fix" either
  // surviving mutation.

  const shapes: [string, (correct: Hex) => Answer][] = [
    ['it is not hex', () => ({ signature: `0x${'zz'.repeat(32)}` })],
    ['it is truncated', (correct) => ({ signature: correct.slice(0, 40) })],
  ]

  for (const [label, response] of shapes) {
    it(`refuses to return a signature when ${label}`, async () => {
      const account = await loggedIn(response)

      const error = await caught(account.signMessage({ message: 'hello' }))

      // Message comes from viem's recovery, not Core, but still names the
      // signature — enough for a caller to place the blame.
      expect(blamesTheSignature(error)).toBe(true)
    })
  }

  it('refuses a valid signature made over a different payload', async () => {
    // Right key, right length, right hex, wrong thing signed — no shape check
    // can see it, so this is the one test the ownership comparisons exist for.
    const elsewhere = await OWNER.sign({ hash: keccak256('0xdeadbeef') })
    const account = await loggedIn(() => ({ signature: elsewhere }))

    const error = await caught(account.signMessage({ message: 'hello' }))

    expect(blamesTheSignature(error)).toBe(true)
  })
})

describe('signing: shapes that must NOT be treated as failures', () => {
  it('accepts a signature the backend sent without an 0x prefix', async () => {
    // `sendSigningRequest` normalizes it; dropping that would reject perfectly
    // good responses.
    const account = await loggedIn((correct) => ({
      signature: correct.slice(2),
    }))

    const signature = await account.signMessage({ message: 'hello' })

    expect(signature).toMatch(SIGNATURE)
    await expect(
      recoverMessageAddress({ message: 'hello', signature }),
    ).resolves.toBe(OWNER.address)
  })

  it('surfaces a rejected token as a request failure, not a signature fault', async () => {
    // Two stamps precede the request here, so a transport error has further to
    // travel than on a bare action.
    const account = await loggedIn(() => ({ status: 401 }))

    const error = await caught(account.signMessage({ message: 'hello' }))

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('401')
  })
})
