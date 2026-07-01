import type { Meta, StoryObj } from '@storybook/react-vite'

import { InfoCard } from '.'

const meta = {
  title: 'Signing/InfoCard',
  component: InfoCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    title: '0.05 ETH',
    subtitle: '$175.00 USD',
    imageSource: 'https://img.icons8.com/color/1200/ethereum.jpg',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InfoCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
