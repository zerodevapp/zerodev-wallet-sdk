import type { Meta, StoryObj } from '@storybook/react-vite'

import { PoweredBy } from '.'

const meta = {
  title: 'Shared/PoweredBy',
  component: PoweredBy,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    className: { control: 'text' },
  },
} satisfies Meta<typeof PoweredBy>

export default meta
type Story = StoryObj<typeof meta>

export const MultipleColors: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PoweredBy className="zd:text-gray-900" />
    </div>
  ),
}
