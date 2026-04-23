import type { Meta, StoryObj } from '@storybook/react-vite'

import { AlertView } from '.'

const meta = {
  title: 'Shared/AlertView',
  component: AlertView,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    title: 'Heads up',
    description:
      'This is a short description explaining the alert context to the user.',
  },
  decorators: [
    (Story) => (
      <div
        className="p-10"
        style={{
          backgroundImage: 'linear-gradient(135deg, #B78C71 0%, #45ABFB 100%)',
          width: 400,
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AlertView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LongDescription: Story = {
  args: {
    title: 'Review transaction',
    description:
      'Please carefully review the transaction details below before confirming. Once submitted, this action cannot be reversed and funds will be sent to the destination address.',
  },
}
