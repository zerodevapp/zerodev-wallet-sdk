import type { Meta, StoryObj } from '@storybook/react-vite'

import { TokenCard } from '.'

const meta = {
  title: 'Signing/TokenCard',
  component: TokenCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    token: {
      symbol: 'ETH',
      network: 'ethereum',
      imageSource: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    },
    pooledAmount: '0.5',
    availableAmount: '1.0',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TokenCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LargeAmounts: Story = {
  args: {
    pooledAmount: '1234.5678',
    availableAmount: '9876.5432',
  },
}
