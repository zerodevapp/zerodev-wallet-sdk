import { describe, expect, it } from 'vitest'
import { announcesWallet, matchesWallet, WALLET_GUIDE } from './walletGuide'

const metamask = WALLET_GUIDE.find((w) => w.id === 'metamask')
if (!metamask) throw new Error('metamask missing from WALLET_GUIDE')

describe('matchesWallet', () => {
  it('matches an announced connector by id', () => {
    expect(matchesWallet({ id: 'io.metamask' }, metamask)).toBe(true)
  })

  it('matches a configured connector claiming rdns as a string', () => {
    expect(
      matchesWallet({ id: 'metaMaskSDK', rdns: 'io.metamask' }, metamask),
    ).toBe(true)
  })

  it('matches a configured connector claiming rdns as an array', () => {
    expect(
      matchesWallet(
        { id: 'metaMaskSDK', rdns: ['io.metamask', 'io.metamask.mobile'] },
        metamask,
      ),
    ).toBe(true)
  })

  it('rejects a connector with a different rdns', () => {
    expect(
      matchesWallet({ id: 'com.other', rdns: 'com.other' }, metamask),
    ).toBe(false)
  })

  it('matches an in-app browser announcement (variant rdns) by name', () => {
    expect(
      matchesWallet(
        { id: 'io.metamask.mobile', name: 'MetaMask', type: 'injected' },
        metamask,
      ),
    ).toBe(true)
  })

  it('rejects a name match from the generic injected connector', () => {
    expect(
      matchesWallet(
        { id: 'injected', name: 'MetaMask', type: 'injected' },
        metamask,
      ),
    ).toBe(false)
  })

  it('rejects a name match from a non-injected connector', () => {
    expect(
      matchesWallet(
        { id: 'metaMaskSDK', name: 'MetaMask', type: 'metaMask' },
        metamask,
      ),
    ).toBe(false)
  })

  it('never matches a guide entry without rdns', () => {
    const noRdns = { id: 'x', name: 'X', icon: 'i', downloadUrl: 'd' }
    expect(matchesWallet({ id: 'io.metamask' }, noRdns)).toBe(false)
  })
})

describe('announcesWallet', () => {
  it('counts an id === rdns announcement', () => {
    expect(announcesWallet({ id: 'io.metamask' }, metamask)).toBe(true)
  })

  it('counts an in-app browser variant announcement by name', () => {
    expect(
      announcesWallet(
        { id: 'io.metamask.mobile', name: 'MetaMask', type: 'injected' },
        metamask,
      ),
    ).toBe(true)
  })

  it('does not count a configured SDK connector claiming the rdns', () => {
    expect(
      announcesWallet({ id: 'metaMaskSDK', rdns: 'io.metamask' }, metamask),
    ).toBe(false)
  })
})
