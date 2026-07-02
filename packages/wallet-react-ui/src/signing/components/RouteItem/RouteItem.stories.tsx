import type { Meta, StoryObj } from '@storybook/react-vite'

import { RouteItem } from '.'

const meta = {
  title: 'Signing/RouteItem',
  component: RouteItem,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    source: 'ethereum',
    destination: 'arbitrum',
    gasFee: '$0.12',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 400 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RouteItem>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
