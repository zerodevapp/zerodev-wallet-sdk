import { SMART_ROUTING_ADDRESS_SERVER_URL } from '@zerodev/smart-routing-address'
import { arbitrum, base, bsc, optimism, soneium } from 'viem/chains'
import { describe, expect, it } from 'vitest'
import { DEFAULT_DASHBOARD_URL, DEFAULT_SOURCE_TOKENS } from '../constants'
import {
  OWNER,
  SMART_ROUTING_ADDRESS,
  TEST_CONFIG,
  TEST_PROJECT_ID,
} from '../test/fixtures'
import type { SmartRoutingAddressConfig } from '../types'
import {
  getSourceTokenSymbol,
  resolveActions,
  resolveBaseUrl,
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
  it('defaults to the latest supported version', () => {
    expect(resolveVersion(TEST_CONFIG)).toBe('1.0.0-alpha.0')
  })

  it('keeps an explicit version', () => {
    expect(resolveVersion({ ...TEST_CONFIG, version: '0.2.0' })).toBe('0.2.0')
  })
})

describe('resolveBaseUrl', () => {
  it('appends the project id to the default server URL', () => {
    expect(resolveBaseUrl(TEST_CONFIG)).toBe(
      `${SMART_ROUTING_ADDRESS_SERVER_URL}/${TEST_PROJECT_ID}`,
    )
  })

  it('appends the project id to a custom server root', () => {
    expect(
      resolveBaseUrl({
        ...TEST_CONFIG,
        baseUrl: 'https://example.com/sra/',
      }),
    ).toBe(`https://example.com/sra/${TEST_PROJECT_ID}`)
  })

  it('does not override the URL without a project id', () => {
    expect(resolveBaseUrl(BARE_CONFIG)).toBeUndefined()
    expect(resolveBaseUrl({ ...BARE_CONFIG, projectId: '' })).toBe(undefined)
  })

  it('keeps a custom baseUrl as-is without a project id', () => {
    expect(
      resolveBaseUrl({
        ...BARE_CONFIG,
        baseUrl: 'https://example.com/sra',
      }),
    ).toBe('https://example.com/sra')
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
  it('excludes USDT on Soneium, which Across deprecated', () => {
    const soneiumTypes = DEFAULT_SOURCE_TOKENS.filter(
      (source) => source.chain.id === soneium.id,
    ).map((source) => source.tokenType)
    expect(soneiumTypes).not.toContain('USDT')
    // Only USDT is dropped; the chain itself stays routable
    expect(soneiumTypes).toContain('USDC')
  })
})

describe('resolveSourceTokens', () => {
  it('returns the default source tokens, excluding token types missing on the destination chain', () => {
    // base has no USDH entry in the SDK token addresses (HyperEVM-only)
    const expected = DEFAULT_SOURCE_TOKENS.filter(
      (source) => source.tokenType !== 'USDH',
    )
    expect(resolveSourceTokens(BARE_CONFIG)).toEqual(expected)
  })

  it('drops native token types for a destination chain without native support', () => {
    // bsc is not in NATIVE_TOKENS_SUPPORTED and maps no WRAPPED_NATIVE
    const sources = resolveSourceTokens({
      targetChainId: bsc.id,
      slippage: 100,
    })
    const tokenTypes = new Set(sources.map((source) => source.tokenType))
    expect([...tokenTypes].sort()).toEqual([
      'DAI',
      'USDC',
      'USDT',
      'WBTC',
      'WETH',
    ])
  })
})

describe('resolveActions', () => {
  it('builds an action per default token type', () => {
    // WRAPPED_NATIVE appears once via Blast (its rebasing WETH, listed
    // without a WETH key); elsewhere it duplicates WETH and is deduped.
    // EURC is excluded via `UNSUPPORTED_TOKEN_TYPES` because the SRA
    // server rejects it.
    const actions = resolveActions(BARE_CONFIG, OWNER)
    expect(Object.keys(actions ?? {})).toEqual([
      'NATIVE',
      'USDC',
      'WETH',
      'USDT',
      'DAI',
      'WBTC',
      'WRAPPED_NATIVE',
    ])
  })

  it('forwards native deposits to the recipient as value', () => {
    const actions = resolveActions(BARE_CONFIG, OWNER)
    const [nativeCall] = actions?.NATIVE?.action ?? []
    expect(nativeCall?.target).toBe(OWNER)
  })

  it('transfers ERC-20 deposits via the FLEX token placeholder', () => {
    const actions = resolveActions(BARE_CONFIG, OWNER)
    const [erc20Call] = actions?.USDC?.action ?? []
    // createCall resolves FLEX.TOKEN_ADDRESS into the sentinel address
    expect(erc20Call?.target).toBe('0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF')
    expect(erc20Call?.value).toBe(0n)
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
