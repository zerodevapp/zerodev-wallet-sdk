import { keccak256, toHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it, vi } from 'vitest'
import type { Client } from '../../client/types.js'
import { buildTurnkeyPayload, sendSigningRequest } from './signingUtils.js'

describe('sendSigningRequest signature recovery', () => {
  it('accepts a real secp256k1 signature from the requested owner', async () => {
    const owner = privateKeyToAccount(`0x${'11'.repeat(32)}`)
    const hash = keccak256(toHex('real-format signature check'))
    const signature = await owner.sign({ hash })
    const request = vi.fn(async () => ({ signature }))
    const client = {
      apiKeyStamper: {
        stamp: vi.fn(async () => ({
          stampHeaderName: 'X-Stamp',
          stampHeaderValue: 'stamp',
        })),
      },
      request,
    } as unknown as Client

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
})
