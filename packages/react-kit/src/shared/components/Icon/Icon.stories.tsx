import type { Meta, StoryObj } from '@storybook/react-vite'

import { Icon, icons } from '.'

const iconNames = Object.keys(icons)

const meta = {
  title: 'Shared/Icon',
  component: Icon,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    name: {
      control: 'select',
      options: iconNames,
    },
    className: { control: 'text' },
  },
  decorators: [
    (Story) => (
      <div style={{ padding: 24, background: '#1a1a1a', borderRadius: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Icon>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    name: 'check',
    className: 'w-6 h-6 text-white',
  },
}

export const AllIcons: Story = {
  args: { name: 'CheckIcon' },
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
        gap: 16,
        width: 800,
      }}
    >
      {iconNames.map((name) => (
        <div
          key={name}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            padding: 12,
          }}
        >
          <Icon name={name} className="w-6 h-6 text-white" />
          <span style={{ color: '#999', fontSize: 10, textAlign: 'center' }}>
            {name.replace(/Icon$/, '')}
          </span>
        </div>
      ))}
    </div>
  ),
}
