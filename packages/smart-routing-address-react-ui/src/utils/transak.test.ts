import { describe, expect, it } from 'vitest'
import { buildTransakUrl } from './transak'

describe('buildTransakUrl', () => {
  it('targets production by default and staging when asked', () => {
    expect(buildTransakUrl({ apiKey: 'k' })).toBe(
      'https://global.transak.com/?apiKey=k',
    )
    expect(buildTransakUrl({ apiKey: 'k', environment: 'STAGING' })).toContain(
      'https://global-stg.transak.com/',
    )
  })

  it('locks the wallet address form when an address is set', () => {
    const url = new URL(
      buildTransakUrl({ apiKey: 'k', walletAddress: '0xabc' }),
    )
    expect(url.searchParams.get('walletAddress')).toBe('0xabc')
    expect(url.searchParams.get('disableWalletAddressForm')).toBe('true')
  })

  it('pre-fills the selected token and network', () => {
    const url = new URL(
      buildTransakUrl({
        apiKey: 'k',
        cryptoCurrencyCode: 'USDC',
        chainId: 8453,
      }),
    )
    expect(url.searchParams.get('cryptoCurrencyCode')).toBe('USDC')
    expect(url.searchParams.get('network')).toBe('base')
  })

  it('omits the network param for chains Transak has no slug for', () => {
    const url = new URL(buildTransakUrl({ apiKey: 'k', chainId: 999999 }))
    expect(url.searchParams.has('network')).toBe(false)
  })
})
