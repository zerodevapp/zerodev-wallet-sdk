import { parseAbi } from 'viem'
import { describe, expect, it } from 'vitest'
import { toPolicies } from './toPolicies.js'

const abi = parseAbi(['function mint(address _to) public'])
const signer = '0x8F140c9340c53f00d01F16Eab8eD4d5C4819c1Be'
const user = '0x1a3E80147d2aeB78F6930e5f211Fb58D2f2B2A74'
const inAnHour = () => Math.floor(Date.now() / 1000) + 3600

describe('toPolicies', () => {
  it('builds one call policy plus an expiry for contract calls', () => {
    const policies = toPolicies({
      signer,
      expiry: inAnHour(),
      permissions: [
        {
          type: 'contract-call',
          target: '0x4eae0b2130d5c3be154ebc851cd1dc0cc694b808',
          abi,
          functionName: 'mint',
          args: [{ condition: 'equal', value: user }],
        },
      ],
    })
    expect(policies.map((p) => p.policyParams.type)).toEqual([
      'call',
      'timestamp',
    ])
  })

  it('builds a sudo policy plus an expiry for sudo', () => {
    const policies = toPolicies({
      signer,
      expiry: inAnHour(),
      permissions: [{ type: 'sudo' }],
    })
    expect(policies.map((p) => p.policyParams.type)).toEqual([
      'sudo',
      'timestamp',
    ])
  })

  it('rejects an expiry in the past, an empty request, and sudo mixed with calls', () => {
    const call = {
      type: 'contract-call' as const,
      target: '0x4eae0b2130d5c3be154ebc851cd1dc0cc694b808' as const,
      abi,
      functionName: 'mint',
    }
    expect(() =>
      toPolicies({ signer, expiry: 1, permissions: [call] }),
    ).toThrow(/future/)
    expect(() =>
      toPolicies({ signer, expiry: inAnHour(), permissions: [] }),
    ).toThrow(/at least one/)
    expect(() =>
      toPolicies({
        signer,
        expiry: inAnHour(),
        permissions: [{ type: 'sudo' }, call],
      }),
    ).toThrow(/sudo/)
  })
})
