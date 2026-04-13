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
  decorators: [
    (Story) => (
      <div style={{ padding: 24, background: '#1a1a1a', borderRadius: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AppLogo>

export default meta
type Story = StoryObj<typeof meta>

export const MultipleColors: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ background: '#ffffff', padding: 16, borderRadius: 8 }}>
        <AppLogo className="text-gray-900" />
      </div>
      <div style={{ background: '#3b82f6', padding: 16, borderRadius: 8 }}>
        <AppLogo className="text-white" />
      </div>
      <div style={{ background: '#10b981', padding: 16, borderRadius: 8 }}>
        <AppLogo className="text-white" />
      </div>
    </div>
  ),
}
