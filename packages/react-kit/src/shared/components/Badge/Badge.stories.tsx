import type { Meta, StoryObj } from '@storybook/react-vite'
import { icons } from '../Icon'
import { Badge } from './index'

const iconNames = Object.keys(icons)

const meta = {
  title: 'Shared/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    text: {
      control: 'text',
      description: 'Badge text',
    },
    variant: {
      control: 'select',
      options: ['primary', 'secondary'],
      description: 'Visual variant',
    },
    leadingIcon: {
      control: 'select',
      options: [undefined, ...iconNames],
      description: 'Leading icon name',
    },
    trailingIcon: {
      control: 'select',
      options: [undefined, ...iconNames],
      description: 'Trailing icon name',
    },
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: {
    text: 'New',
    variant: 'primary',
  },
}

export const Secondary: Story = {
  args: {
    text: 'Updated',
    variant: 'secondary',
  },
}

export const WithLeadingIcon: Story = {
  args: {
    text: 'Verified',
    variant: 'secondary',
    leadingIcon: 'check',
  },
}

export const WithTrailingIcon: Story = {
  args: {
    text: 'Next',
    variant: 'primary',
    trailingIcon: 'chevronRight',
  },
}

export const WithBothIcons: Story = {
  args: {
    text: 'Complete',
    variant: 'secondary',
    leadingIcon: 'check',
    trailingIcon: 'chevronRight',
  },
}

export const AllVariants = {
  args: {
    text: 'Example',
  },
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 flex-wrap">
        <Badge text="Primary" variant="primary" />
        <Badge text="Secondary" variant="secondary" />
      </div>
      <div className="flex gap-2 flex-wrap">
        <Badge text="With Icon" variant="secondary" leadingIcon="check" />
        <Badge text="Trailing" variant="primary" trailingIcon="chevronRight" />
      </div>
      <div className="flex gap-2 flex-wrap">
        <Badge
          text="Both Icons"
          variant="secondary"
          leadingIcon="check"
          trailingIcon="chevronRight"
        />
      </div>
    </div>
  ),
} satisfies Story
