import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from '.'

const meta = {
  title: 'Shared/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    action: {
      control: 'select',
      options: ['primary', 'secondary', 'secondaryNeutral'],
    },
    text: { control: 'text' },
    disabled: { control: 'boolean' },
    trailIcon: { control: 'boolean' },
  },
  args: {
    action: 'primary',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: {
    text: 'Connect Wallet',
    action: 'primary',
  },
}

export const Secondary: Story = {
  args: {
    text: 'Cancel',
    action: 'secondary',
  },
}

export const SecondaryNeutral: Story = {
  args: {
    text: 'Settings',
    action: 'secondaryNeutral',
  },
}

export const Disabled: Story = {
  args: {
    text: 'Unavailable',
    action: 'primary',
    disabled: true,
  },
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-72">
      <Button text="Primary" action="primary" />
      <Button text="Secondary" action="secondary" />
      <Button text="Secondary Neutral" action="secondaryNeutral" />
      <Button text="Disabled" action="primary" disabled />
    </div>
  ),
}
