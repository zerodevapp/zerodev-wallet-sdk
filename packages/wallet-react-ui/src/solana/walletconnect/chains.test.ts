import { describe, expect, it } from 'vitest'
import {
  caip2ToSolanaChain,
  parseSessionAccount,
  SOLANA_CAIP2,
  solanaChainToCaip2,
} from './chains'

describe('solana chain ids', () => {
  it('maps CAIP-2 ids, deprecated ones included, to Wallet Standard names', () => {
    expect(caip2ToSolanaChain(SOLANA_CAIP2.mainnet)).toBe('solana:mainnet')
    expect(caip2ToSolanaChain(SOLANA_CAIP2.deprecatedMainnet)).toBe(
      'solana:mainnet',
    )
    expect(caip2ToSolanaChain(SOLANA_CAIP2.devnet)).toBe('solana:devnet')
    expect(caip2ToSolanaChain(SOLANA_CAIP2.deprecatedDevnet)).toBe(
      'solana:devnet',
    )
    expect(caip2ToSolanaChain('solana:nope')).toBeUndefined()
  })

  it('maps Wallet Standard names to the canonical CAIP-2 id', () => {
    expect(solanaChainToCaip2('solana:mainnet')).toBe(SOLANA_CAIP2.mainnet)
    expect(solanaChainToCaip2('solana:localnet')).toBeUndefined()
  })

  it('parses a session account', () => {
    expect(
      parseSessionAccount(
        `${SOLANA_CAIP2.devnet}:7S3P4HxJpyyigGzodYwHtCxZyUQe`,
      ),
    ).toEqual({
      caip2: SOLANA_CAIP2.devnet,
      address: '7S3P4HxJpyyigGzodYwHtCxZyUQe',
    })
    expect(parseSessionAccount('eip155:1:0xabc')).toBeUndefined()
    expect(parseSessionAccount('solana:x')).toBeUndefined()
  })
})
