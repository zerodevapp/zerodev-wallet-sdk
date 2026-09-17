import { keccak256, toHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it, vi } from 'vitest'
import type { Client } from '../../client/types.js'
import type { SigningStamper } from '../../stampers/types.js'
import { buildTurnkeyPayload, sendSigningRequest } from './signingUtils.js'

async function signedBy(owner: ReturnType<typeof privateKeyToAccount>) {
  const hash = keccak256(toHex('real-format signature check'))
  const signature = await owner.sign({ hash })
  return { hash, signature }
}

function fakeClient(
  signature: string,
  stampHeaderName = 'X-Stamp',
): {
  client: Client<undefined, SigningStamper>
  request: ReturnType<typeof vi.fn>
} {
  const request = vi.fn(async () => ({ signature }))
  const client = {
    apiKeyStamper: {
      stamp: vi.fn(async () => ({
        stampHeaderName,
        stampHeaderValue: 'stamp',
      })),
    },
    request,
  } as unknown as Client<undefined, SigningStamper>
  return { client, request }
}

type Call = {
  path: string
  headers: Record<string, string>
  body: { stampHeader: { stampHeaderName: string } }
}

describe('sendSigningRequest', () => {
  const owner = privateKeyToAccount(`0x${'11'.repeat(32)}`)

  it('accepts a real secp256k1 signature from the requested owner', async () => {
    const { hash, signature } = await signedBy(owner)
    const { client, request } = fakeClient(signature)

    await expect(
      sendSigningRequest(client, {
        projectId: 'project',
        token: 'token',
        path: 'sign/test',
        turnkeyPayload: buildTurnkeyPayload(
          'organization',
          owner.address,
          hash,
        ),
        bodyFields: { payload: 'test' },
      }),
    ).resolves.toBe(signature)
    expect(request).toHaveBeenCalledOnce()
  })

  it('sends the session as a bearer token when given one', async () => {
    const { hash, signature } = await signedBy(owner)
    const { client, request } = fakeClient(signature)

    await sendSigningRequest(client, {
      projectId: 'project',
      token: 'token',
      path: 'sign/transaction',
      turnkeyPayload: buildTurnkeyPayload('organization', owner.address, hash),
      bodyFields: {},
    })

    const [call] = request.mock.calls[0] as [Call]
    expect(call.path).toBe('project/sign/transaction')
    expect(call.headers.Authorization).toBe('Bearer token')
  })

  it('sends no bearer token without a session and names the inner stamp X-Stamp whatever the outer header is', async () => {
    const { hash, signature } = await signedBy(owner)
    const { client, request } = fakeClient(signature, 'X-Agent-Stamp')

    await sendSigningRequest(client, {
      projectId: 'project',
      path: 'server-wallet/sign/message',
      turnkeyPayload: buildTurnkeyPayload('organization', owner.address, hash),
      bodyFields: {},
    })

    const [call] = request.mock.calls[0] as [Call]
    expect(call.path).toBe('project/server-wallet/sign/message')
    expect(call.headers.Authorization).toBeUndefined()
    expect(call.headers['X-Agent-Stamp']).toBe('stamp')
    expect(call.body.stampHeader.stampHeaderName).toBe('X-Stamp')
  })

  it('keeps a WebAuthn stamper header name on the inner stamp', async () => {
    const { hash, signature } = await signedBy(owner)
    const { client, request } = fakeClient(signature, 'X-Stamp-Webauthn')

    await sendSigningRequest(client, {
      projectId: 'project',
      token: 'token',
      path: 'sign/message',
      turnkeyPayload: buildTurnkeyPayload('organization', owner.address, hash),
      bodyFields: {},
    })

    const [call] = request.mock.calls[0] as [Call]
    expect(call.body.stampHeader.stampHeaderName).toBe('X-Stamp-Webauthn')
  })
})
