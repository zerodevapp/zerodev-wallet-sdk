import type { Meta, StoryObj } from '@storybook/react-vite'

import { AppLogo } from '.'

const meta = {
  title: 'Shared/AppLogo',
  component: AppLogo,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    className: { control: 'text' },
  },
} satisfies Meta<typeof AppLogo>

export default meta
type Story = StoryObj<typeof meta>

export const MultipleColors: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <AppLogo className="text-gray-900" />
    </div>
  ),
}
