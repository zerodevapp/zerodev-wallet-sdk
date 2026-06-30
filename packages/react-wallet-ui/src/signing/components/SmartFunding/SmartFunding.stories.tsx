import type { Meta, StoryObj } from '@storybook/react-vite'

import { SmartFunding, type SmartFundingProps } from '.'

const pooledTokens: SmartFundingProps['pooledTokens'] = [
  {
    token: {
      symbol: 'ETH',
      network: 'ethereum',
      imageSource: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    },
    pooledAmount: '0.3',
    availableAmount: '1.0',
  },
  {
    token: {
      symbol: 'ETH',
      network: 'arbitrum',
      imageSource: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    },
    pooledAmount: '0.2',
    availableAmount: '0.5',
  },
]

const meta = {
  title: 'Signing/SmartFunding',
  component: SmartFunding,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    inputTokenSymbol: 'ETH',
    pooledTokens,
    totalPooledAmount: '0.5',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 400 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SmartFunding>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NoPooledTokens: Story = {
  args: {
    pooledTokens: [],
    totalPooledAmount: '0',
  },
}

export const SingleToken: Story = {
  args: {
    pooledTokens: [pooledTokens[0]!],
    totalPooledAmount: '0.3',
  },
}
