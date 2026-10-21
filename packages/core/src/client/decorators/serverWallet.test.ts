import { describe, expect, it, vi } from 'vitest'
import * as actions from '../../actions/serverWallet/index.js'
import type { SigningStamper } from '../../stampers/types.js'
import type { Client } from '../types.js'
import { serverWalletActions } from './serverWallet.js'

vi.mock('../../actions/serverWallet/index.js', () => ({
  createServerWallet: vi.fn(async () => 'created'),
  createServerWalletAddress: vi.fn(async () => 'address-created'),
  signMessage: vi.fn(async () => 'message-signature'),
  signTransaction: vi.fn(async () => 'transaction-signature'),
  signTypedDataV4: vi.fn(async () => 'typed-data-signature'),
  sign7702Authorization: vi.fn(async () => 'authorization-signature'),
}))

const client = { uid: 'client' } as unknown as Client<undefined, SigningStamper>

describe('serverWalletActions', () => {
  it('binds exactly the six agent actions', () => {
    expect(Object.keys(serverWalletActions(client)).sort()).toEqual([
      'createServerWallet',
      'createServerWalletAddress',
      'sign7702Authorization',
      'signMessage',
      'signTransaction',
      'signTypedDataV4',
    ])
  })

  it.each([
    ['createServerWallet', actions.createServerWallet, 'created'],
    [
      'createServerWalletAddress',
      actions.createServerWalletAddress,
      'address-created',
    ],
    ['signMessage', actions.signMessage, 'message-signature'],
    ['signTransaction', actions.signTransaction, 'transaction-signature'],
    ['signTypedDataV4', actions.signTypedDataV4, 'typed-data-signature'],
    [
      'sign7702Authorization',
      actions.sign7702Authorization,
      'authorization-signature',
    ],
  ] as const)(
    '%s forwards the client and params',
    async (name, action, result) => {
      const params = { projectId: 'project' }

      await expect(
        serverWalletActions(client)[name](params as never),
      ).resolves.toBe(result)
      expect(action).toHaveBeenCalledWith(client, params)
    },
  )
})
