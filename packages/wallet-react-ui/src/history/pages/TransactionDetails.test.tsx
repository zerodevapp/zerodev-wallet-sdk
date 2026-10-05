import { cleanup, render, screen } from '@testing-library/react'
import type { TransactionHistoryTransaction } from '@zerodev/wallet-data'
import { afterEach, describe, expect, it } from 'vitest'
import {
  failedTx,
  nftMintTx,
  pendingTx,
  sendTx,
  swapTx,
  unknownStatusTx,
} from '../fixtures'
import { TransactionDetails } from './TransactionDetails'

afterEach(cleanup)

function withoutExplorer(
  tx: TransactionHistoryTransaction,
): TransactionHistoryTransaction {
  const { explorerTxUrl: _, ...chain } = tx.chain
  return { ...tx, chain }
}

describe('TransactionDetails', () => {
  it('renders a send with its hero, fee, and network', () => {
    render(<TransactionDetails transaction={sendTx} />)
    expect(screen.getByText('25 USDC')).toBeDefined()
    expect(screen.getByText('$25.00')).toBeDefined()
    expect(screen.getByText('0.00021 ETH ($0.53)')).toBeDefined()
    expect(screen.getAllByText('Ethereum Sepolia').length).toBeGreaterThan(0)
    expect(screen.getByText('Success')).toBeDefined()
    expect(screen.getByText('Confirmed on Ethereum Sepolia')).toBeDefined()
  })

  it('renders a swap hero on the destination side and both cards', () => {
    render(<TransactionDetails transaction={swapTx} />)
    expect(screen.getAllByText('2,498.12 USDC')).toHaveLength(2)
    expect(screen.getByText('1 ETH')).toBeDefined()
    expect(screen.getByText('$2,500.00')).toBeDefined()
    expect(screen.getByText('2.5 USDC ($2.50)')).toBeDefined()
  })

  it('renders an NFT mint without a token amount', () => {
    render(<TransactionDetails transaction={nftMintTx} />)
    expect(screen.queryAllByText(/^[\d.,]+ [A-Z]+$/)).toHaveLength(0)
    expect(screen.getByText('Transaction details')).toBeDefined()
    expect(screen.getByText('Confirmed on Ethereum Sepolia')).toBeDefined()
  })

  it.each([
    [failedTx, 'Failed', 'Failed on Ethereum Sepolia'],
    [pendingTx, 'Pending', 'Confirming on Ethereum Sepolia'],
    [unknownStatusTx, 'Unknown', 'Status unknown'],
  ] as const)(
    'renders %#: status %s with progress "%s"',
    (tx, status, progress) => {
      render(<TransactionDetails transaction={tx} />)
      expect(screen.getByText(status)).toBeDefined()
      expect(screen.getByText(progress)).toBeDefined()
    },
  )

  it('links the hash to the explorer when the chain has an explorer URL', () => {
    render(<TransactionDetails transaction={sendTx} />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(link.getAttribute('href')).toBe(sendTx.chain.explorerTxUrl)
      expect(link.getAttribute('target')).toBe('_blank')
    }
  })

  it('renders the hash as plain text without an explorer URL', () => {
    render(<TransactionDetails transaction={withoutExplorer(sendTx)} />)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.getByText('0x0000...0001')).toBeDefined()
  })
})
