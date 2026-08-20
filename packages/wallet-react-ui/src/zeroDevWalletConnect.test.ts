import { beforeEach, describe, expect, it, vi } from 'vitest'
import { zeroDevWalletConnect } from './zeroDevWalletConnect'

const { walletConnect } = vi.hoisted(() => ({
  walletConnect: vi.fn(() => 'wc-connector-fn'),
}))
vi.mock('wagmi/connectors', () => ({ walletConnect }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('zeroDevWalletConnect', () => {
  it('bakes showQrModal: false into the wagmi connector', () => {
    const result = zeroDevWalletConnect({ projectId: 'pid' })
    expect(walletConnect).toHaveBeenCalledWith({
      projectId: 'pid',
      showQrModal: false,
    })
    expect(result).toBe('wc-connector-fn')
  })

  it('throws early without a projectId', () => {
    expect(() => zeroDevWalletConnect({ projectId: '' })).toThrow(/projectId/)
    expect(walletConnect).not.toHaveBeenCalled()
  })
})
