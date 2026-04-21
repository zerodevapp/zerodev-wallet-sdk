import type { Meta, StoryObj } from '@storybook/react-vite'
import { Text } from '../Text'
import { WrappedPressable } from '.'

const meta = {
  title: 'Shared/WrappedPressable',
  component: WrappedPressable,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
  },
  args: {
    children: <Text className="text-white">Press me</Text>,
  },
  decorators: [
    (Story) => (
      <div className="p-10 bg-greyScale">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WrappedPressable>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    className: 'h-12 px-6',
  },
}
