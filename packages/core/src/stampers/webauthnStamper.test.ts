import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getWebAuthnAttestationMock, stampMock, stamperCtorArgs } = vi.hoisted(
  () => ({
    getWebAuthnAttestationMock: vi.fn(),
    stampMock: vi.fn(),
    stamperCtorArgs: [] as unknown[],
  }),
)

vi.mock('@turnkey/http', () => ({
  getWebAuthnAttestation: getWebAuthnAttestationMock,
}))
vi.mock('@turnkey/webauthn-stamper', () => ({
  WebauthnStamper: class {
    stamp = stampMock
    constructor(config: unknown) {
      stamperCtorArgs.push(config)
    }
  },
}))

import { base64UrlEncode } from '../utils/utils.js'
import { createWebauthnStamper } from './webauthnStamper.js'

const rp = { id: 'wallet.example.com', name: 'Example Wallet' }
const registration = { rp, userName: 'alice@example.com' }
const fakeAttestation = {
  attestationObject: 'att-obj',
  clientDataJson: 'cdj',
  credentialId: 'cred-id',
}

beforeEach(() => {
  getWebAuthnAttestationMock.mockReset().mockResolvedValue(fakeAttestation)
  stampMock.mockReset().mockResolvedValue({
    stampHeaderName: 'X-Stamp',
    stampHeaderValue: 'sig',
  })
  stamperCtorArgs.length = 0
})

// publicKey options handed to getWebAuthnAttestation on the Nth register() call.
const pkArg = (n = 0) => getWebAuthnAttestationMock.mock.calls[n][0].publicKey

describe('createWebauthnStamper', () => {
  it('constructs the Turnkey webauthn stamper with the given rpId', async () => {
    await createWebauthnStamper({ rpId: 'wallet.example.com' })
    expect(stamperCtorArgs).toEqual([{ rpId: 'wallet.example.com' }])
  })
})

describe('register()', () => {
  // Login resolves credentials with an empty allowCredentials list, which can
  // only surface discoverable (resident) credentials — so registration must
  // create a resident credential, otherwise the passkey can never be used to
  // log in.
  it('requires a discoverable (resident) credential', async () => {
    const stamper = await createWebauthnStamper({ rpId: rp.id })
    await stamper.register(registration)
    expect(pkArg().authenticatorSelection).toEqual({
      residentKey: 'required',
      userVerification: 'preferred',
    })
  })

  it('advertises ES256 and RS256 credential params', async () => {
    const stamper = await createWebauthnStamper({ rpId: rp.id })
    await stamper.register(registration)
    expect(pkArg().pubKeyCredParams).toEqual([
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ])
  })

  it('forwards rp and the user name/displayName from options', async () => {
    const stamper = await createWebauthnStamper({ rpId: rp.id })
    await stamper.register(registration)
    const pk = pkArg()
    expect(pk.rp).toBe(rp)
    expect(pk.user.name).toBe('alice@example.com')
    expect(pk.user.displayName).toBe('alice@example.com')
  })

  it('generates an ArrayBuffer challenge and user id', async () => {
    const stamper = await createWebauthnStamper({ rpId: rp.id })
    await stamper.register(registration)
    const pk = pkArg()
    expect(pk.challenge).toBeInstanceOf(ArrayBuffer)
    expect(pk.user.id).toBeInstanceOf(ArrayBuffer)
  })

  it('returns the attestation and an encodedChallenge matching the challenge sent', async () => {
    const stamper = await createWebauthnStamper({ rpId: rp.id })
    const result = await stamper.register(registration)
    expect(result.attestation).toBe(fakeAttestation)
    expect(result.encodedChallenge).toBe(base64UrlEncode(pkArg().challenge))
  })

  it('uses a fresh challenge and user id on each registration', async () => {
    const stamper = await createWebauthnStamper({ rpId: rp.id })
    await stamper.register(registration)
    await stamper.register(registration)
    expect(base64UrlEncode(pkArg(0).challenge)).not.toBe(
      base64UrlEncode(pkArg(1).challenge),
    )
    expect(base64UrlEncode(pkArg(0).user.id)).not.toBe(
      base64UrlEncode(pkArg(1).user.id),
    )
  })
})

describe('stamp() and clear()', () => {
  it('delegates stamp() to the Turnkey stamper and returns its Stamp', async () => {
    const stamper = await createWebauthnStamper({ rpId: rp.id })
    const out = await stamper.stamp('request-body')
    expect(stampMock).toHaveBeenCalledWith('request-body')
    expect(out).toEqual({ stampHeaderName: 'X-Stamp', stampHeaderValue: 'sig' })
  })

  it('clear() resolves as a no-op', async () => {
    const stamper = await createWebauthnStamper({ rpId: rp.id })
    await expect(stamper.clear()).resolves.toBeUndefined()
  })
})
