import type { Meta, StoryObj } from '@storybook/react-vite'

import { MessageDetails } from '.'

const meta = {
  title: 'MessageDetails',
  component: MessageDetails,
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
} satisfies Meta<typeof MessageDetails>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    details: {
      From: '0x1234...5678',
      To: '0xabcd...efab',
      Amount: '0.05 ETH',
      Nonce: '42',
    },
  },
}
