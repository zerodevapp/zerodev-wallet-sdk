/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from '@testing-library/react'
import type { DepositedToken } from '@zerodev/smart-routing-address'
import { arbitrum, base } from 'viem/chains'
import { afterEach, describe, expect, it } from 'vitest'
import type { EstimatedFee, SmartRoutingAddressConfig } from '../../types'
import { PendingDeposits } from './index'

afterEach(cleanup)

const config: SmartRoutingAddressConfig = {
  targetChainId: arbitrum.id,
  slippage: 50,
}

const USDC_ON_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

const estimatedFees: EstimatedFee[] = [
  {
    chainId: base.id,
    data: [
      {
        name: 'USDC',
        token: USDC_ON_BASE as `0x${string}`,
        decimal: 6,
        fee: '0x3d090' as `0x${string}`,
        minDeposit: '0xf4240' as `0x${string}`,
        isSponsored: false,
      },
    ],
  },
]

const now = Date.now()
const iso = (msAgo: number): string => new Date(now - msAgo).toISOString()

const detectedDeposit = {
  deposit: {
    chainId: base.id,
    token: USDC_ON_BASE,
    amount: '248000000',
    blockNumber: '0x1',
    transactionHash:
      '0x4d2a00000000000000000000000000000000000000000000000000000000ba99',
  },
  bridge: null,
  execution: null,
  error: null,
  createdAt: iso(2 * 60 * 1000),
} as unknown as DepositedToken

const bridgingDeposit = {
  ...detectedDeposit,
  bridge: { blockNumber: '0x2', transactionHash: '0xbr' },
} as unknown as DepositedToken
const completedDeposit = {
  ...detectedDeposit,
  bridge: { blockNumber: '0x2', transactionHash: '0xbr' },
  execution: {
    blockNumber: '0x3',
    chainId: arbitrum.id,
    outputToken: '0xdst',
    transactionHash: '0xex',
    outputAmount: '247750000',
  },
} as unknown as DepositedToken
const failedDeposit = {
  ...detectedDeposit,
  error: 'Route expired',
} as unknown as DepositedToken

describe('PendingDeposits', () => {
  it('renders nothing when there are no deposits', () => {
    const { container } = render(
      <PendingDeposits
        deposits={[]}
        estimatedFees={estimatedFees}
        config={config}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the "Pending Deposit" section header', () => {
    render(
      <PendingDeposits
        deposits={[detectedDeposit]}
        estimatedFees={estimatedFees}
        config={config}
      />,
    )
    expect(screen.getByText('Pending Deposit')).toBeDefined()
  })

  it('renders one row per deposit', () => {
    render(
      <PendingDeposits
        deposits={[detectedDeposit, bridgingDeposit, completedDeposit]}
        estimatedFees={estimatedFees}
        config={config}
      />,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it.each([
    { name: 'pending', deposit: detectedDeposit, label: 'Detected' },
    { name: 'bridging', deposit: bridgingDeposit, label: 'Routing' },
    { name: 'completed', deposit: completedDeposit, label: 'Received' },
    { name: 'failed (error field)', deposit: failedDeposit, label: 'Failed' },
  ])('maps $name stage to "$label" status', ({ deposit, label }) => {
    render(
      <PendingDeposits
        deposits={[deposit]}
        estimatedFees={estimatedFees}
        config={config}
      />,
    )
    expect(screen.getByText(label)).toBeDefined()
  })
})
