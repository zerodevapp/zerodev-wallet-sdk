import type { Meta, StoryObj } from '@storybook/react-vite'

import { Input } from '.'

const meta = {
  title: 'Shared/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'ghost', 'listItemStyle'],
    },
    multiline: { control: 'boolean' },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
  },
  args: {
    variant: 'default',
    placeholder: 'Enter text…',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    placeholder: 'Enter your name',
  },
}

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    placeholder: 'Search…',
  },
}

export const ListItemStyle: Story = {
  args: {
    variant: 'listItemStyle',
    placeholder: 'Amount',
  },
}

export const Multiline: Story = {
  args: {
    multiline: true,
    placeholder: 'Enter a message…',
  },
}

export const MultilineGhost: Story = {
  args: {
    variant: 'ghost',
    multiline: true,
    placeholder: 'Notes…',
  },
}

export const Disabled: Story = {
  args: {
    placeholder: 'Cannot edit',
    disabled: true,
  },
}

export const WithChildren: Story = {
  args: {
    placeholder: '0.00',
  },
  render: (args) => (
    <Input {...args}>
      <span style={{ padding: '0 8px', color: '#888', fontSize: 14 }}>ETH</span>
    </Input>
  ),
}

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Input variant="default" placeholder="Default variant" />
      <Input variant="ghost" placeholder="Ghost variant" />
      <Input variant="listItemStyle" placeholder="List item variant" />
      <Input multiline placeholder="Multiline default" />
    </div>
  ),
}
