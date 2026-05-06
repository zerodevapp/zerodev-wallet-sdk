import type { Meta, StoryObj } from '@storybook/react-vite'

import { TxInformation } from '.'

const meta = {
  title: 'Signing/TxInformation',
  component: TxInformation,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    network: 'ethereum',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 400 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TxInformation>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
