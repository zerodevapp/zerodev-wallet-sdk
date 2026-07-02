import type { Meta, StoryObj } from '@storybook/react-vite'

import { Text } from '.'

const meta = {
  title: 'Shared/Text',
  component: Text,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    as: {
      control: 'select',
      options: ['p', 'span', 'label'],
    },
    children: { control: 'text' },
    className: { control: 'text' },
  },
  args: {
    children: 'The quick brown fox jumps over the lazy dog.',
  },
} satisfies Meta<typeof Text>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const AsSpan: Story = {
  args: {
    as: 'span',
    children: 'Inline span text',
  },
}

export const AsLabel: Story = {
  args: {
    as: 'label',
    children: 'Label text',
  },
}

export const CustomColor: Story = {
  args: {
    children: 'Orange text',
    className: 'zd:text-orange',
  },
}

export const LargerSize: Story = {
  args: {
    children: 'Larger body1 text',
    className: 'zd:text-body1',
  },
}

export const AllSizes: Story = {
  render: () => (
    <div className="zd:flex zd:flex-col zd:gap-3">
      <Text className="zd:text-h1">Heading 1</Text>
      <Text className="zd:text-h2">Heading 2</Text>
      <Text className="zd:text-h3">Heading 3</Text>
      <Text className="zd:text-body1">Body 1</Text>
      <Text>Body 2 (default)</Text>
      <Text className="zd:text-body3">Body 3</Text>
      <Text className="zd:text-body4">Body 4</Text>
    </div>
  ),
}
