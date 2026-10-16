import type { Meta, StoryObj } from '@storybook/react-vite'

import { TxHistoryItem, TxHistoryItemSkeleton } from '.'

const SEPOLIA = {
  name: 'Ethereum Sepolia',
  iconUri:
    'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
}

const meta = {
  title: 'History/TxHistoryItem',
  component: TxHistoryItem,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['Pending', 'Success', 'Failed', 'Unknown'],
    },
  },
  args: {
    icon: 'circleArrowUp',
    title: 'Sent USDC',
    chain: SEPOLIA,
    status: 'Success',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 352 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TxHistoryItem>

export default meta
type Story = StoryObj<typeof meta>

export const Sent: Story = {
  args: {
    value: '25 USDC',
  },
}

export const Swap: Story = {
  args: {
    icon: 'arrowSwapHorizontalOutline',
    title: 'Swapped ETH → USDC',
    value: '2,343 USDC',
    unit: 'USDC',
    status: 'Pending',
  },
}

export const WithAssetImage: Story = {
  args: {
    icon: 'circleArrowDown',
    title: 'Received USDC',
    value: '25 USDC',
    unit: 'USDC',
    imageUri:
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
  },
}

export const BrokenAssetImage: Story = {
  args: {
    icon: 'circleArrowDown',
    title: 'Received USDC',
    value: '25 USDC',
    unit: 'USDC',
    imageUri: 'https://example.invalid/missing.png',
  },
}

export const ReceivedNft: Story = {
  args: {
    icon: 'imageFill',
    title: 'Received NFT',
    value: 'Bored Ape Yacht Club',
  },
}

export const LongValueTruncates: Story = {
  args: {
    icon: 'stars',
    title: 'Minted NFT',
    value: 'An exceptionally long collection name that cannot fit',
  },
}

export const NoValue: Story = {
  args: {
    icon: 'bezierCurve',
    title: 'Deployed contract',
  },
}

export const NoChainIcon: Story = {
  args: {
    value: '25 USDC',
    chain: { name: 'Ethereum Sepolia' },
  },
}

export const Failed: Story = {
  args: {
    value: '25 USDC',
    status: 'Failed',
  },
}

export const Unknown: Story = {
  args: {
    icon: 'question',
    title: 'Unknown transaction',
    status: 'Unknown',
  },
}

export const Skeleton: Story = {
  render: () => <TxHistoryItemSkeleton />,
}

export const LongSymbol: Story = {
  args: {
    icon: 'circleArrowDown',
    title: 'Received SUPERCALIFRAGILISTICEXPIALIDOCIOUS',
    value: '1,234.57 SUPERCALIFRAGILISTICEXPIALIDOCIOUS',
    unit: 'SUPERCALIFRAGILISTICEXPIALIDOCIOUS',
  },
}

export const LongValue: Story = {
  args: {
    icon: 'circleArrowDown',
    title: 'Received ETH',
    value: '0.000000000000000001 ETH',
    unit: 'ETH',
  },
}
