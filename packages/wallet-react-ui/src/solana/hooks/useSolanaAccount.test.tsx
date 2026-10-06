/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react'
import type { WalletAccount } from '@wallet-standard/base'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createStore } from '../../store'
import type { SolanaStandardWallet } from '../types'
import { useSolanaAccount } from './useSolanaAccount'

let store = createStore()
vi.mock('../../shared/hooks/useKitStore', () => ({
  useKitStore: () => store,
}))
const fakeWagmiConfig = {
  state: { connections: new Map(), current: null, status: 'disconnected' },
  setState: () => {},
  subscribe: () => () => {},
  _internal: { events: { change() {}, disconnect() {}, connect() {} } },
}
vi.mock('wagmi', () => ({ useConfig: () => fakeWagmiConfig }))

const account: WalletAccount = {
  address: '7S3P4HxJpyyigGzodYwHtCxZyUQe9JiBMHyRWXArAaKv',
  publicKey: new Uint8Array(32).fill(1),
  chains: ['solana:mainnet'],
  features: ['solana:signMessage'],
}

function makeWallet() {
  return {
    version: '1.0.0',
    name: 'Phantom',
    icon: 'data:image/svg+xml;base64,',
    chains: ['solana:mainnet'],
    accounts: [],
    features: {
      'standard:connect': {
        version: '1.0.0',
        connect: vi.fn(async () => ({ accounts: [account] })),
      },
      'standard:disconnect': {
        version: '1.0.0',
        disconnect: vi.fn(async () => {}),
      },
    },
  } as unknown as SolanaStandardWallet
}

beforeEach(() => {
  store = createStore()
})

describe('useSolanaAccount', () => {
  it('connects a wallet outside the sign-up flow and reports it', async () => {
    const { result } = renderHook(() => useSolanaAccount())
    expect(result.current.isConnected).toBe(false)

    const wallet = makeWallet()
    await act(async () => {
      await result.current.connect(wallet)
    })
    expect(result.current.isConnected).toBe(true)
    expect(result.current.address).toBe(account.address)
    expect(result.current.walletName).toBe('Phantom')

    await act(async () => {
      await result.current.disconnect()
    })
    expect(result.current.isConnected).toBe(false)
  })

  it('rejects when the wallet declines, leaving the slot disconnected', async () => {
    const { result } = renderHook(() => useSolanaAccount())
    const wallet = makeWallet()
    const connect = wallet.features['standard:connect'].connect as ReturnType<
      typeof vi.fn
    >
    connect.mockRejectedValueOnce(new Error('User rejected the request'))

    await expect(
      act(async () => {
        await result.current.connect(wallet)
      }),
    ).rejects.toThrow('User rejected')
    expect(result.current.isConnected).toBe(false)
  })
})
