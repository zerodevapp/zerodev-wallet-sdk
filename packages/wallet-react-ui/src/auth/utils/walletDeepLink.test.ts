import { describe, expect, it } from 'vitest'
import { WALLET_GUIDE, type WalletGuideEntry } from '../walletGuide'
import { walletDeepLink } from './walletDeepLink'

const metamask = WALLET_GUIDE.find((w) => w.id === 'metamask')
if (!metamask) throw new Error('metamask missing from WALLET_GUIDE')

/** Params for the happy path — each test overrides one dimension. */
const fresh = () => ({
  wallet: metamask,
  connectors: [],
  uri: 'wc:abc@2',
  mobile: true,
})

describe('walletDeepLink', () => {
  it('wraps the URI in the wallet deep link for a mobile tap', () => {
    expect(walletDeepLink(fresh())).toBe(
      `${metamask.mobileLink}${encodeURIComponent('wc:abc@2')}`,
    )
  })

  it('is null on desktop', () => {
    expect(walletDeepLink({ ...fresh(), mobile: false })).toBeNull()
  })

  it('is null before the URI arrives', () => {
    expect(walletDeepLink({ ...fresh(), uri: null })).toBeNull()
  })

  it('is null when an installed connector claims the wallet', () => {
    expect(
      walletDeepLink({ ...fresh(), connectors: [{ id: 'io.metamask' }] }),
    ).toBeNull()
  })

  it("is null inside the wallet's in-app browser (variant rdns announcement)", () => {
    expect(
      walletDeepLink({
        ...fresh(),
        connectors: [
          { id: 'io.metamask.mobile', name: 'MetaMask', type: 'injected' },
        ],
      }),
    ).toBeNull()
  })

  it('is null for a wallet without a mobile link', () => {
    const wallet: WalletGuideEntry = {
      id: 'nolink',
      name: 'NoLink',
      icon: '',
      downloadUrl: 'https://example.com',
    }
    expect(walletDeepLink({ ...fresh(), wallet })).toBeNull()
  })
})
