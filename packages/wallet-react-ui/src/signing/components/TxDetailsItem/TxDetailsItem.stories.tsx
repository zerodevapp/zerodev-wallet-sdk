import type { Meta, StoryObj } from '@storybook/react-vite'

import { TxDetailsItem } from '.'

const meta = {
  title: 'Signing/TxDetailsItem',
  component: TxDetailsItem,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    title: 'Approve USDC',
    index: 1,
    data: {
      from: '0x1234...abcd',
      to: '0x5678...ef01',
      amount: '100 USDC',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TxDetailsItem>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
