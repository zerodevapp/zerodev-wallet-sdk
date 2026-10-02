import { describe, expect, it } from 'vitest'
import { decodePermissionContext } from './revokePermission.js'

// Shape written by @zerodev/permissions' serializePermissionAccount.
const context = btoa(
  JSON.stringify({
    permissionParams: {
      permissionId: '0x1a2b3c4d',
      policies: [
        { policyParams: { type: 'call' } },
        { policyParams: { type: 'timestamp' } },
      ],
    },
    accountParams: {
      accountAddress: '0x1a3E80147d2aeB78F6930e5f211Fb58D2f2B2A74',
      initCode: '0x',
    },
    enableSignature: '0x',
  }),
)

describe('decodePermissionContext', () => {
  it('reads the account, permission id, and policy count', () => {
    expect(decodePermissionContext(context)).toEqual({
      account: '0x1a3E80147d2aeB78F6930e5f211Fb58D2f2B2A74',
      permissionId: '0x1a2b3c4d',
      policyCount: 2,
    })
  })
})
