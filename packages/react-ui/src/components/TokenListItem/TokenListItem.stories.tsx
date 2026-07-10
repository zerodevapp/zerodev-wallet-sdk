import type { Meta, StoryObj } from '@storybook/react-vite'

import { TokenListItem } from '.'

const meta = {
  title: 'Shared/TokenListItem',
  component: TokenListItem,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: 352 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TokenListItem>

export default meta
type Story = StoryObj<typeof meta>

export const Token: Story = {
  args: {
    symbol: 'ETH',
    subtitle: '3 networks',
    iconName: 'ethereum',
    value: '$0.00',
    change: '+13.31%',
  },
}

export const InclChain: Story = {
  args: {
    symbol: 'ETH',
    subtitle: 'Arbitrum',
    subtitleIcon: 'arbitrum',
    iconName: 'ethereum',
    value: '$0.00',
    change: '+13.31%',
  },
}

export const Network: Story = {
  args: {
    symbol: 'ETH',
    subtitle: '3 networks',
    iconName: 'ethereum',
    iconVariant: 'network',
    value: '$0.00',
    change: '+13.31%',
  },
}

export const NegativeChange: Story = {
  args: {
    symbol: 'ETH',
    subtitle: '3 networks',
    iconName: 'ethereum',
    value: '$0.00',
    change: '-2.15%',
  },
}

export const Loading: Story = {
  args: { symbol: '', loading: true },
}
