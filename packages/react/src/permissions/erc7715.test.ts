import { parseAbi } from 'viem'
import { describe, expect, it } from 'vitest'
import { fromErc7715Request, toErc7715Request } from './erc7715.js'
import type { GrantPermissionsParameters } from './types.js'

const signer = '0x8F140c9340c53f00d01F16Eab8eD4d5C4819c1Be'
const user = '0x1a3E80147d2aeB78F6930e5f211Fb58D2f2B2A74'
const vault = '0x4eae0b2130d5c3be154ebc851cd1dc0cc694b808'

const params: GrantPermissionsParameters = {
  signer,
  chainId: 421614,
  expiry: 1_800_000_000,
  permissions: [
    {
      type: 'contract-call',
      label: 'Demo NFT',
      target: vault,
      abi: parseAbi([
        'function mint(address _to) public',
        'function transfer(address to, uint256 amount) public',
      ]),
      functionName: 'transfer',
      args: [
        { condition: 'equal', value: user },
        { condition: 'lessThanOrEqual', value: 50_000_000n },
      ],
      valueLimit: 0n,
    },
  ],
}

describe('ERC-7715 translation', () => {
  it('puts rules in a zerodev-arg-rules policy with hex amounts', () => {
    const req = toErc7715Request(params)
    expect(req.chainId).toBe('0x66eee')
    expect(req.signer).toEqual({ type: 'account', data: { id: signer } })
    expect(req.permissions[0]).toMatchObject({
      type: 'contract-call',
      data: {
        address: vault,
        calls: ['function transfer(address to, uint256 amount)'],
        label: 'Demo NFT',
      },
      policies: [
        {
          type: 'zerodev-arg-rules',
          data: {
            args: [
              { condition: 'equal', value: user },
              { condition: 'lessThanOrEqual', value: '0x2faf080' },
            ],
          },
        },
      ],
    })
  })

  it('round-trips to the same grant, with amounts back as bigint', () => {
    const back = fromErc7715Request(toErc7715Request(params))
    expect(back.signer).toBe(signer)
    expect(back.chainId).toBe(421614)
    expect(back.expiry).toBe(params.expiry)
    expect(back.permissions[0]).toMatchObject({
      type: 'contract-call',
      target: vault,
      functionName: 'transfer',
      label: 'Demo NFT',
      args: [
        { condition: 'equal', value: user },
        { condition: 'lessThanOrEqual', value: 50_000_000n },
      ],
    })
  })

  it('maps sudo both ways', () => {
    const req = toErc7715Request({
      signer,
      expiry: 1,
      permissions: [{ type: 'sudo' }],
    })
    expect(req.permissions[0]?.type).toBe('zerodev-sudo')
    expect(fromErc7715Request(req).permissions).toEqual([{ type: 'sudo' }])
  })

  it('rejects standard types ZeroDev does not support yet', () => {
    expect(() =>
      fromErc7715Request({
        expiry: 1,
        signer: { type: 'account', data: { id: signer } },
        permissions: [
          {
            type: 'native-token-transfer',
            data: { ticker: 'ETH' },
            policies: [],
          },
        ],
      }),
    ).toThrow(/not supported/)
  })
})
