import type { Meta, StoryObj } from '@storybook/react-vite'
import { icons } from '../Icon'
import { IconButton } from '.'

const iconNames = Object.keys(icons)

const meta = {
  title: 'Shared/IconButton',
  component: IconButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    iconName: {
      control: 'select',
      options: iconNames,
    },
    disabled: { control: 'boolean' },
  },
  args: {
    iconName: 'check',
  },
} satisfies Meta<typeof IconButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    iconName: 'check',
  },
}

export const Disabled: Story = {
  args: {
    iconName: 'check',
    disabled: true,
  },
}
