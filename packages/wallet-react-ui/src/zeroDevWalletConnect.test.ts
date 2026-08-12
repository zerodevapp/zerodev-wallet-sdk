import { beforeEach, describe, expect, it, vi } from 'vitest'
import { zeroDevWalletConnect } from './zeroDevWalletConnect'

const { walletConnect } = vi.hoisted(() => ({
  walletConnect: vi.fn(() => () => ({ id: 'walletConnect' })),
}))
vi.mock('wagmi/connectors', () => ({ walletConnect }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('zeroDevWalletConnect', () => {
  it('bakes showQrModal: false into the wagmi connector', () => {
    zeroDevWalletConnect({ projectId: 'pid' })
    expect(walletConnect).toHaveBeenCalledWith({
      projectId: 'pid',
      showQrModal: false,
    })
  })

  it('forwards extra WalletConnect parameters', () => {
    const metadata = {
      name: 'My App',
      description: '',
      url: 'https://my.app',
      icons: [],
    }
    zeroDevWalletConnect({ projectId: 'pid', metadata })
    expect(walletConnect).toHaveBeenCalledWith({
      projectId: 'pid',
      metadata,
      showQrModal: false,
    })
  })

  it('stamps the connector instance for the kit discovery', () => {
    const create = zeroDevWalletConnect({ projectId: 'pid' })
    const connector = create({} as never)
    expect(connector).toEqual({ id: 'walletConnect', zdWalletConnect: true })
  })

  it('throws early without a projectId', () => {
    expect(() => zeroDevWalletConnect({ projectId: '' })).toThrow(/projectId/)
    expect(walletConnect).not.toHaveBeenCalled()
  })
})
