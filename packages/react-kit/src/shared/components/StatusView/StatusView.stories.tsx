import type { Meta, StoryObj } from '@storybook/react-vite'

import { StatusView } from '.'

const meta = {
  title: 'Shared/StatusView',
  component: StatusView,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    imageName: {
      control: 'select',
      options: ['error', 'loading', 'send', 'success'],
    },
    title: { control: 'text' },
    children: { control: 'text' },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StatusView>

export default meta
type Story = StoryObj<typeof meta>

export const Success: Story = {
  args: {
    imageName: 'success',
    title: 'Transaction Sent',
    children: 'Your funds are on the way. This may take a few moments.',
  },
}
