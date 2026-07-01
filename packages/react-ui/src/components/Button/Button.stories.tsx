import type { Meta, StoryObj } from '@storybook/react-vite'
import { icons } from '../Icon'
import { Button } from '.'

const iconNames = Object.keys(icons)

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
      options: ['primary', 'secondary'],
    },
    iconName: {
      control: 'select',
      options: [undefined, ...iconNames],
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

export const Disabled: Story = {
  args: {
    text: 'Unavailable',
    action: 'primary',
    disabled: true,
  },
}

export const WithLeadingIcon: Story = {
  args: {
    text: 'Send',
    action: 'primary',
    iconName: 'rocket',
  },
}

export const WithTrailingIcon: Story = {
  args: {
    text: 'Next',
    action: 'primary',
    iconName: 'arrowRightFill',
    trailIcon: true,
  },
}

export const IconOnly: Story = {
  args: {
    action: 'primary',
    iconName: 'check',
  },
}

export const SecondaryWithIcon: Story = {
  args: {
    text: 'Copy',
    action: 'secondary',
    iconName: 'copy',
  },
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-72">
      <Button text="Primary" action="primary" />
      <Button text="Secondary" action="secondary" />
      <Button text="Disabled" action="primary" disabled />
      <Button text="With Icon" action="primary" iconName="rocket" />
      <Button
        text="Trail Icon"
        action="primary"
        iconName="arrowRightFill"
        trailIcon
      />
      <Button action="secondary" iconName="check" />
    </div>
  ),
}
