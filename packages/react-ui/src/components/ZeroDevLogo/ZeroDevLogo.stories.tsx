import type { Meta, StoryObj } from '@storybook/react-vite'

import { ZeroDevLogo } from '.'

const meta = {
  title: 'Shared/ZeroDevLogo',
  component: ZeroDevLogo,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['mark', 'lockup'],
    },
    tone: {
      control: 'select',
      options: ['black', 'offwhite', 'color', 'orange'],
    },
    className: { control: 'text' },
  },
} satisfies Meta<typeof ZeroDevLogo>

export default meta
type Story = StoryObj<typeof meta>

export const Mark: Story = {
  args: {
    variant: 'mark',
    tone: 'black',
    className: 'zd:h-16 zd:w-auto',
  },
}

export const Lockup: Story = {
  args: {
    variant: 'lockup',
    tone: 'black',
    className: 'zd:h-10 zd:w-auto',
  },
}

// Every valid (variant, tone) combination. offwhite sits on a dark tile so it
// stays visible.
const COMBOS = [
  { variant: 'mark', tone: 'black' },
  { variant: 'mark', tone: 'offwhite' },
  { variant: 'mark', tone: 'color' },
  { variant: 'mark', tone: 'orange' },
  { variant: 'lockup', tone: 'black' },
  { variant: 'lockup', tone: 'offwhite' },
] as const

export const AllVariants: Story = {
  args: { variant: 'mark', tone: 'black' },
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(200px, 1fr))',
        gap: 16,
        width: 500,
      }}
    >
      {COMBOS.map(({ variant, tone }) => (
        <div
          key={`${variant}-${tone}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: 20,
            borderRadius: 12,
            background: tone === 'offwhite' ? '#19110b' : '#faf7f4',
          }}
        >
          <ZeroDevLogo
            variant={variant}
            tone={tone}
            className="zd:h-12 zd:w-auto"
          />
          <span
            style={{
              color: tone === 'offwhite' ? '#faf7f4' : '#999',
              fontSize: 11,
            }}
          >
            {variant} / {tone}
          </span>
        </div>
      ))}
    </div>
  ),
}
