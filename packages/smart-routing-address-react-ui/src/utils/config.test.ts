import { SMART_ROUTING_ADDRESS_V1_0_0 } from '@zerodev/smart-routing-address'
import { arbitrum, base, bsc, optimism, robinhood } from 'viem/chains'
import { describe, expect, it } from 'vitest'
import { DEFAULT_DASHBOARD_URL, DEFAULT_SOURCE_TOKENS } from '../constants'
import { OWNER, SMART_ROUTING_ADDRESS, TEST_CONFIG } from '../test/fixtures'
import type { SmartRoutingAddressConfig } from '../types'
import {
  getSourceTokenSymbol,
  resolveActions,
  resolveDashboardUrl,
  resolveDestChain,
  resolveSourceTokens,
  resolveVersion,
} from './config'

/** Minimal config without routes, exercising the defaults */
const BARE_CONFIG: SmartRoutingAddressConfig = {
  targetChainId: base.id,
  slippage: 100,
}

describe('resolveVersion', () => {
  it('defaults to the latest stable version', () => {
    expect(resolveVersion(TEST_CONFIG)).toBe('1.0.0')
  })

  it('keeps an explicit version', () => {
    expect(resolveVersion({ ...TEST_CONFIG, version: '0.2.0' })).toBe('0.2.0')
  })
})

describe('resolveDashboardUrl', () => {
  it('appends the address path to the default dashboard URL', () => {
    expect(resolveDashboardUrl(SMART_ROUTING_ADDRESS)).toBe(
      `${DEFAULT_DASHBOARD_URL}/address/${SMART_ROUTING_ADDRESS}`,
    )
  })

  it('returns the bare URL without an address', () => {
    expect(resolveDashboardUrl()).toBe(DEFAULT_DASHBOARD_URL)
  })
})

describe('resolveDestChain', () => {
  it('resolves the target chain id to a viem chain', () => {
    expect(resolveDestChain(TEST_CONFIG)).toBe(base)
  })

  it('throws for unsupported target chain ids', () => {
    expect(() =>
      resolveDestChain({ ...TEST_CONFIG, targetChainId: 999_999 }),
    ).toThrow(/Unsupported chain id 999999/)
  })
})

describe('DEFAULT_SOURCE_TOKENS', () => {
  it('offers Robinhood chain deposits (native, WETH and USDG)', () => {
    // Robinhood is an SRA-only source chain — it is not in the wallet's own
    // chain list, so it regressing out of SUPPORTED_CHAINS is easy to miss.
    const robinhoodTypes = DEFAULT_SOURCE_TOKENS.filter(
      (source) => source.chain.id === robinhood.id,
    ).map((source) => source.tokenType)
    expect(robinhoodTypes.sort()).toEqual(['NATIVE', 'USDG', 'WETH'])
  })
})

describe('resolveSourceTokens', () => {
  it('returns the default source tokens, excluding token types missing on the destination chain', () => {
    // base maps no WBTC and no USDG in the SDK's supported tokens
    const expected = DEFAULT_SOURCE_TOKENS.filter(
      (source) => source.tokenType !== 'WBTC' && source.tokenType !== 'USDG',
    )
    expect(resolveSourceTokens(BARE_CONFIG)).toEqual(expected)
  })

  it('drops native token types for a destination chain without native support', () => {
    // bsc maps only USDC/USDT/WETH — no NATIVE entry
    const sources = resolveSourceTokens({
      targetChainId: bsc.id,
      slippage: 100,
    })
    const tokenTypes = new Set(sources.map((source) => source.tokenType))
    expect([...tokenTypes].sort()).toEqual(['USDC', 'USDT', 'WETH'])
  })
})

describe('resolveActions', () => {
  it('builds an action per default token type', () => {
    const actions = resolveActions(
      BARE_CONFIG,
      OWNER,
      SMART_ROUTING_ADDRESS_V1_0_0,
    )
    expect(Object.keys(actions)).toEqual(['NATIVE', 'USDC', 'WETH', 'USDT'])
  })

  it('forwards native deposits to the recipient as value', () => {
    const actions = resolveActions(
      BARE_CONFIG,
      OWNER,
      SMART_ROUTING_ADDRESS_V1_0_0,
    )
    const [nativeCall] = actions.NATIVE?.action ?? []
    expect(nativeCall?.target).toBe(OWNER)
  })

  it('transfers ERC-20 deposits via the FLEX token placeholder', () => {
    const actions = resolveActions(
      BARE_CONFIG,
      OWNER,
      SMART_ROUTING_ADDRESS_V1_0_0,
    )
    const [erc20Call] = actions.USDC?.action ?? []
    // createCall resolves FLEX.TOKEN_ADDRESS into the sentinel address
    expect(erc20Call?.target).toBe('0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF')
    expect(erc20Call?.value).toBe(0n)
  })

  it('omits fallBack for v1 and includes it for legacy versions', () => {
    // v0.x managers run `fallBack` when the action reverts; v1 has none
    const v1 = resolveActions(BARE_CONFIG, OWNER, SMART_ROUTING_ADDRESS_V1_0_0)
    expect(v1.USDC).not.toHaveProperty('fallBack')

    const legacy = resolveActions(BARE_CONFIG, OWNER, '0.2.1')
    expect(legacy.USDC?.fallBack).toEqual(legacy.USDC?.action)
  })
})

describe('token symbols', () => {
  it('uses the chain native symbol for NATIVE source tokens', () => {
    expect(getSourceTokenSymbol({ tokenType: 'NATIVE', chain: arbitrum })).toBe(
      'ETH',
    )
  })

  it('prefixes wrapped native tokens', () => {
    expect(
      getSourceTokenSymbol({
        tokenType: 'WRAPPED_NATIVE',
        chain: optimism,
      }),
    ).toBe('WETH')
  })
})
