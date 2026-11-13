import type { Meta, StoryObj } from '@storybook/react-vite'

import { Text } from '../Text'
import { ProgressStep } from './index'

const meta = {
  title: 'ProgressStep',
  component: ProgressStep,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['done', 'active', 'pending', 'failed'],
    },
  },
  args: {
    label: 'Deposit detected',
    status: 'done',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 344 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressStep>

export default meta
type Story = StoryObj<typeof meta>

export const Done: Story = {}

export const Active: Story = {
  args: { label: 'Wait 30 minutes', status: 'active' },
}

export const Pending: Story = {
  args: { label: 'Funds arrived on L2', status: 'pending', isLast: true },
}

export const Failed: Story = {
  args: { label: 'Failed', status: 'failed', isLast: true },
}

export const WithInfoAndTrailing: Story = {
  args: {
    label: 'Routing',
    status: 'active',
    info: 'Your deposit is being routed to the destination chain.',
    right: (
      <Text className="zd:text-body3 zd:text-neutral-tertiary">
        5 minutes remaining
      </Text>
    ),
  },
}

/** A full trail as callers compose it: stacked steps, final one `isLast`. */
export const Trail: Story = {
  render: () => (
    <div className="zd:flex zd:w-full zd:flex-col">
      <ProgressStep label="Transaction initiated" status="done" />
      <ProgressStep
        label="Wait 30 minutes"
        status="active"
        right={
          <Text className="zd:text-body3 zd:text-neutral-tertiary">
            5 minutes remaining
          </Text>
        }
      />
      <ProgressStep label="Funds arrived on L2" status="pending" isLast />
    </div>
  ),
}
