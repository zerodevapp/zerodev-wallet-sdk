import type { Meta, StoryObj } from '@storybook/react-vite'

import { SmartFundingGasDetails } from '.'

const meta = {
  title: 'Signing/SmartFundingGasDetails',
  component: SmartFundingGasDetails,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    executionTime: 45,
    slippage: 0.5,
    gasRoutes: {
      bridge: [
        { source: 'ethereum', destination: 'arbitrum', gasFee: '$0.12' },
        { source: 'ethereum', destination: 'arbitrum', gasFee: '$0.08' },
      ],
      swapped: [
        { source: 'ethereum', destination: 'arbitrum', gasFee: '$0.05' },
      ],
    },
    providerFees: [
      { provider: 'ZeroDev', percentage: 0.1, fee: '$0.10' },
      { provider: 'LI.FI', percentage: 0.2, fee: '$0.20' },
    ],
    bridgeAmount: '0.3 ETH',
    swapAmount: '0.2 ETH',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SmartFundingGasDetails>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
