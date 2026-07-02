import type { Meta, StoryObj } from '@storybook/react-vite'

import { StatusScreen } from '.'

const meta = {
  title: 'Shared/StatusScreen',
  component: StatusScreen,
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
} satisfies Meta<typeof StatusScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Success: Story = {
  args: {
    imageName: 'success',
    title: 'Transaction Sent',
    children: 'Your funds are on the way. This may take a few moments.',
  },
}
