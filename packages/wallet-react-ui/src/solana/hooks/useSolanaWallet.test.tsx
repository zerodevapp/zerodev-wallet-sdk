/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react'
import type { WalletAccount } from '@wallet-standard/base'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createStore } from '../../store'
import type { SolanaStandardWallet } from '../types'
import { useSolanaWallet } from './useSolanaWallet'

let store = createStore()
vi.mock('../../shared/hooks/useKitStore', () => ({
  useKitStore: () => store,
}))

const account: WalletAccount = {
  address: '7S3P4HxJpyyigGzodYwHtCxZyUQe9JiBMHyRWXArAaKv',
  publicKey: new Uint8Array(32).fill(1),
  chains: ['solana:mainnet', 'solana:devnet'],
  features: ['solana:signMessage'],
}

function walletWith(features: Record<string, unknown>) {
  return {
    version: '1.0.0',
    name: 'Phantom',
    icon: 'data:image/svg+xml;base64,',
    chains: ['solana:mainnet'],
    accounts: [account],
    features: {
      'standard:connect': {
        version: '1.0.0',
        connect: async () => ({ accounts: [account] }),
      },
      ...features,
    },
  } as unknown as SolanaStandardWallet
}

beforeEach(() => {
  store = createStore()
})

describe('useSolanaWallet', () => {
  it('is null while disconnected', () => {
    const { result } = renderHook(() => useSolanaWallet())
    expect(result.current).toBeNull()
  })

  it('wraps the wallet signing features with the connected account', async () => {
    const signMessage = vi.fn(async () => [
      { signature: new Uint8Array([9]), signedMessage: new Uint8Array([1]) },
    ])
    const signTransaction = vi.fn(async () => [
      { signedTransaction: new Uint8Array([2, 2]) },
    ])
    const signAndSendTransaction = vi.fn(async () => [
      { signature: new Uint8Array([3]) },
    ])
    const wallet = walletWith({
      'solana:signMessage': { version: '1.1.0', signMessage },
      'solana:signTransaction': {
        version: '1.0.0',
        supportedTransactionVersions: ['legacy', 0],
        signTransaction,
      },
      'solana:signAndSendTransaction': {
        version: '1.0.0',
        supportedTransactionVersions: ['legacy', 0],
        signAndSendTransaction,
      },
    })
    await store.getState().solana.connect(wallet)

    const { result } = renderHook(() => useSolanaWallet())
    const handle = result.current
    expect(handle?.wallet).toBe(wallet)

    const message = new Uint8Array([104, 105])
    await expect(handle?.signMessage?.(message)).resolves.toEqual({
      signature: new Uint8Array([9]),
      signedMessage: new Uint8Array([1]),
    })
    expect(signMessage).toHaveBeenCalledWith({ account, message })

    const tx = new Uint8Array([7])
    await expect(handle?.signTransaction?.(tx)).resolves.toEqual(
      new Uint8Array([2, 2]),
    )
    expect(signTransaction).toHaveBeenCalledWith({
      account,
      transaction: tx,
      chain: 'solana:mainnet',
    })

    await handle?.signAndSendTransaction?.(tx, 'solana:devnet', {
      skipPreflight: true,
    })
    expect(signAndSendTransaction).toHaveBeenCalledWith({
      account,
      transaction: tx,
      chain: 'solana:devnet',
      options: { skipPreflight: true },
    })
  })

  it('exposes null for features the wallet lacks', async () => {
    await store.getState().solana.connect(walletWith({}))
    const { result } = renderHook(() => useSolanaWallet())
    expect(result.current?.signMessage).toBeNull()
    expect(result.current?.signTransaction).toBeNull()
    expect(result.current?.signAndSendTransaction).toBeNull()
  })
})
