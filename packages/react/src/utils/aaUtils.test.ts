import { describe, expect, it } from 'vitest'
import { ZERODEV_AA_HOST, ZERODEV_AA_VERSION } from '../constants.js'
import { getAAUrl } from './aaUtils.js'

describe('getAAUrl', () => {
  it('builds the default per-chain URL (SDK-owned host + version)', () => {
    expect(getAAUrl('proj', 421614)).toBe(
      `${ZERODEV_AA_HOST}/api/${ZERODEV_AA_VERSION}/proj/chain/421614`,
    )
  })

  it('appends the chainId per chain (multichain-safe)', () => {
    expect(getAAUrl('proj', 11155111)).toContain('/chain/11155111')
    expect(getAAUrl('proj', 8453)).toContain('/chain/8453')
  })

  it('overrides only the host via aaHost; version + path stay SDK-owned', () => {
    expect(getAAUrl('proj', 1, 'https://rpc.zerodev.app')).toBe(
      `https://rpc.zerodev.app/api/${ZERODEV_AA_VERSION}/proj/chain/1`,
    )
  })

  it('trims a trailing slash on aaHost', () => {
    expect(getAAUrl('proj', 1, 'https://rpc.zerodev.app/')).toBe(
      `https://rpc.zerodev.app/api/${ZERODEV_AA_VERSION}/proj/chain/1`,
    )
  })
})
