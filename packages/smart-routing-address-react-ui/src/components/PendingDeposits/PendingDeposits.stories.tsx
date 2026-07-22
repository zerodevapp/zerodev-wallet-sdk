import type { Meta, StoryObj } from '@storybook/react-vite'
import { Screen } from '@zerodev/react-ui'
import type { DepositedToken } from '@zerodev/smart-routing-address'
import { arbitrum, base, optimism, polygon } from 'viem/chains'
import type { EstimatedFee, SmartRoutingAddressConfig } from '../../types'
import { PendingDeposits } from './index'

const config: SmartRoutingAddressConfig = {
  targetChainId: arbitrum.id,
  slippage: 50,
}

// USDC token addresses on each source chain, used to build believable
// fixtures whose feeData lookups match the source picker's would.
const USDC_ON_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const USDT_ON_POLYGON = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
const USDC_ON_OPTIMISM = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'

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
  {
    chainId: polygon.id,
    data: [
      {
        name: 'USDT',
        token: USDT_ON_POLYGON as `0x${string}`,
        decimal: 6,
        fee: '0x493e0' as `0x${string}`,
        minDeposit: '0xf4240' as `0x${string}`,
        isSponsored: false,
      },
    ],
  },
  {
    chainId: optimism.id,
    data: [
      {
        name: 'USDC',
        token: USDC_ON_OPTIMISM as `0x${string}`,
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

// Each fixture reuses the same shape as a real `DepositedToken` (plus the
// optional `createdAt` some SRA servers ship). We control the stage via the
// bridge/execution/error fields — no branching logic in the component under
// test.
const deposits = [
  // Just detected — no bridge/execution yet → "Detected".
  {
    deposit: {
      chainId: base.id,
      token: USDC_ON_BASE,
      amount: '248000000',
      blockNumber: '0x1',
      transactionHash:
        '0x4d2a0000000000000000000000000000000000000000000000000000000000ba99',
    },
    bridge: null,
    execution: null,
    error: null,
    createdAt: iso(2 * 60 * 1000), // 2 m ago
  },
  // Bridge fired but execution pending → "Routing".
  {
    deposit: {
      chainId: polygon.id,
      token: USDT_ON_POLYGON,
      amount: '120500000',
      blockNumber: '0x1',
      transactionHash:
        '0x88af0000000000000000000000000000000000000000000000000000000003c21',
    },
    bridge: { blockNumber: '0x2', transactionHash: '0xbrhash' },
    execution: null,
    error: null,
    createdAt: iso(12 * 60 * 1000), // 12 m ago
  },
  // Execution done → "Received".
  {
    deposit: {
      chainId: optimism.id,
      token: USDC_ON_OPTIMISM,
      amount: '1000000000',
      blockNumber: '0x1',
      transactionHash:
        '0xa1a10000000000000000000000000000000000000000000000000000000009e42',
    },
    bridge: { blockNumber: '0x2', transactionHash: '0xbrhash' },
    execution: {
      blockNumber: '0x3',
      chainId: arbitrum.id,
      outputToken: '0xdst',
      transactionHash: '0xex',
      outputAmount: '999750000',
    },
    error: null,
    createdAt: iso(3 * 3600 * 1000), // 3 h ago
  },
  // Error → "Failed".
  {
    deposit: {
      chainId: base.id,
      token: USDC_ON_BASE,
      amount: '50000',
      blockNumber: '0x1',
      transactionHash:
        '0xdead0000000000000000000000000000000000000000000000000000000000beef',
    },
    bridge: null,
    execution: null,
    error: 'Route expired before it could be filled',
    createdAt: iso(5 * 3600 * 1000), // 5 h ago
  },
] as unknown as DepositedToken[]

const meta: Meta<typeof PendingDeposits> = {
  title: 'SmartRoutingAddress/PendingDeposits',
  component: PendingDeposits,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      // Render inside the real SRA `Screen` chrome so the section's text
      // tint, translucent surfaces, and TxnItem pair-marks read like they
      // will in production.
      <Screen size="lg">
        <Story />
      </Screen>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

/** Full section with one row per stage (Detected → Routing → Received → Failed). */
export const AllStages: Story = {
  args: {
    deposits,
    estimatedFees,
    config,
  },
}

/** Single in-flight deposit — matches the Figma "Pending Deposit" screenshot. */
export const SingleRouting: Story = {
  args: {
    deposits: [deposits[1]] as DepositedToken[],
    estimatedFees,
    config,
  },
}

/** Empty state — component returns `null`, so nothing renders. */
export const Empty: Story = {
  args: {
    deposits: [],
    estimatedFees,
    config,
  },
}
