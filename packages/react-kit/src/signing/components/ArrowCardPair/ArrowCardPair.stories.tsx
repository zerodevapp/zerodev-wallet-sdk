import type { Meta, StoryObj } from '@storybook/react-vite'

import { InfoCard } from '../InfoCard'
import { ArrowCardPair } from '.'

const meta = {
  title: 'Signing/ArrowCardPair',
  component: ArrowCardPair,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ArrowCardPair>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    topCard: (
      <InfoCard
        title="0.05 ETH"
        subtitle="$175.00 USD"
        imageSource="https://img.icons8.com/color/1200/ethereum.jpg"
      />
    ),
    bottomCard: (
      <InfoCard
        title="175 USDC"
        subtitle="$175.00 USD"
        imageSource="https://img.icons8.com/external-black-fill-lafs/64/external-USDC-cryptocurrency-black-fill-lafs.png"
      />
    ),
  },
}
