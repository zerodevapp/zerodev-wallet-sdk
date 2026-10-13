import { describe, expect, it } from 'vitest'
import type { SolanaConnection } from './types'
import { findSolanaUiAccount } from './uiAccount'

const connection = {
  source: 'standard',
  wallet: { name: 'Phantom' },
  address: 'addr1',
} as unknown as SolanaConnection

describe('findSolanaUiAccount', () => {
  it('finds the connected account by wallet name and address', () => {
    const wallets = [
      { name: 'Solflare', accounts: [{ address: 'addr1', tag: 'wrong' }] },
      {
        name: 'phantom ',
        accounts: [
          { address: 'other', tag: 'x' },
          { address: 'addr1', tag: 'right' },
        ],
      },
    ]
    expect(findSolanaUiAccount(wallets, connection)?.tag).toBe('right')
    expect(findSolanaUiAccount(wallets, null)).toBeUndefined()
    expect(findSolanaUiAccount([], connection)).toBeUndefined()
  })
})
