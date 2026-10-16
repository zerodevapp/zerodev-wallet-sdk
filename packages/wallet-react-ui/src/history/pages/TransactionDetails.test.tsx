import { cleanup, render, screen } from '@testing-library/react'
import type { TransactionHistoryTransaction } from '@zerodev/wallet-data'
import { afterEach, describe, expect, it } from 'vitest'
import {
  approveUnlimitedTx,
  deployTx,
  failedTx,
  nftMintTx,
  paidMintTx,
  pendingTx,
  revokeTx,
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
    expect(screen.getByText('Sent USDC')).toBeDefined()
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

  it('renders an NFT mint with the NFT as the hero and no token amount', () => {
    const { container } = render(<TransactionDetails transaction={nftMintTx} />)
    expect(screen.getByText('ZeroDev Pass')).toBeDefined()
    expect(screen.getByText('#42')).toBeDefined()
    expect(
      container.querySelector('img[src="https://cdn.zerion.io/nft/42.png"]'),
    ).not.toBeNull()
    expect(screen.queryAllByText(/^[\d.,]+ [A-Z]+$/)).toHaveLength(0)
    expect(screen.getByText('Transaction details')).toBeDefined()
    expect(screen.getByText('Confirmed on Ethereum Sepolia')).toBeDefined()
  })

  it('renders a paid mint with the NFT hero and a card for each side', () => {
    const { container } = render(
      <TransactionDetails transaction={paidMintTx} />,
    )
    expect(screen.getAllByText('Bonfires NFT ×5')).toHaveLength(2)
    expect(screen.getAllByText('#0')).toHaveLength(2)
    expect(screen.getByText('0.5 ETH')).toBeDefined()
    expect(screen.getByText('$1,250.00')).toBeDefined()
    expect(
      container.querySelectorAll(
        'img[src="https://cdn.zerion.io/nft/bonfires.png"]',
      ),
    ).toHaveLength(2)
  })

  it('shows the token id under the hero whatever the NFT name contains', () => {
    render(
      <TransactionDetails
        transaction={{
          ...nftMintTx,
          nft: { tokenId: '1974', name: 'Rexy #1974' },
        }}
      />,
    )
    expect(screen.getByText('Rexy #1974')).toBeDefined()
    expect(screen.getByText('#1974')).toBeDefined()
  })

  it('shows only the token id when the NFT has no name', () => {
    render(
      <TransactionDetails
        transaction={{ ...nftMintTx, nft: { tokenId: '42' } }}
      />,
    )
    expect(screen.getAllByText('#42')).toHaveLength(1)
  })

  it('headlines an asset-less transaction with its operation', () => {
    render(<TransactionDetails transaction={deployTx} />)
    expect(screen.getByText('Deployed contract')).toBeDefined()
  })

  it('renders an allowance without a USD line', () => {
    render(<TransactionDetails transaction={approveUnlimitedTx} />)
    expect(screen.getByText('Unlimited USDC')).toBeDefined()
    expect(screen.queryByText(/^\$/)).toBeNull()
    cleanup()
    render(<TransactionDetails transaction={revokeTx} />)
    expect(screen.getByText('USDC')).toBeDefined()
    expect(screen.queryByText('$0.00')).toBeNull()
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
