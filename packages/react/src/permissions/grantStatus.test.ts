import { zeroAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import { classifyGrant, type GrantChainState } from './grantStatus.js'

const NOW = 1_800_000_000
const grant = { expiry: NOW + 3600, enableNonce: 1 }
const NO_HOOK = '0x0000000000000000000000000000000000000001' as const

const chain = (s: Partial<GrantChainState>): GrantChainState => ({
  installedNonce: 0,
  hook: zeroAddress,
  currentNonce: 1,
  validNonceFrom: 0,
  ...s,
})

describe('classifyGrant', () => {
  it('is expired past its expiry, whatever the chain says', () => {
    expect(
      classifyGrant(
        { ...grant, expiry: NOW },
        chain({ hook: NO_HOOK, installedNonce: 1 }),
        NOW,
      ),
    ).toBe('expired')
  })

  it('is active once installed', () => {
    // Real staging state: installed at nonce 1, hook 0x…01, currentNonce still 1.
    expect(
      classifyGrant(
        grant,
        chain({ hook: NO_HOOK, installedNonce: 1, currentNonce: 1 }),
        NOW,
      ),
    ).toBe('active')
  })

  it('is revoked when installed but below an invalidated nonce', () => {
    expect(
      classifyGrant(
        grant,
        chain({
          hook: NO_HOOK,
          installedNonce: 1,
          currentNonce: 3,
          validNonceFrom: 3,
        }),
        NOW,
      ),
    ).toBe('revoked')
  })

  it('is revoked after uninstall: hook cleared, nonce kept', () => {
    expect(
      classifyGrant(grant, chain({ installedNonce: 1, currentNonce: 2 }), NOW),
    ).toBe('revoked')
  })

  it('is pending while unused and the account nonce has not moved', () => {
    expect(classifyGrant(grant, chain({ currentNonce: 1 }), NOW)).toBe(
      'pending',
    )
  })

  it('is void once the account nonce has moved', () => {
    expect(classifyGrant(grant, chain({ currentNonce: 2 }), NOW)).toBe('void')
  })

  it('is void after a nonce invalidation', () => {
    expect(
      classifyGrant(grant, chain({ currentNonce: 2, validNonceFrom: 2 }), NOW),
    ).toBe('void')
  })
})
