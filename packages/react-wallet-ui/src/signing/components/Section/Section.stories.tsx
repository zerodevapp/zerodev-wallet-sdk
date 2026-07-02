import type { Meta, StoryObj } from '@storybook/react-vite'

import { icons, Text } from '@zerodev/react-ui'
import { Section } from '.'

const iconNames = Object.keys(icons)

const meta = {
  title: 'Signing/Section',
  component: Section,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    iconName: {
      control: 'select',
      options: iconNames,
    },
    collapsible: {
      control: 'select',
      options: [undefined, true, false],
    },
  },
  args: {
    title: 'Transaction details',
    iconName: 'wallet',
    children: (
      <div className="zd:flex zd:flex-col zd:gap-2">
        <Text>Some random text</Text>
      </div>
    ),
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Section>

export default meta
type Story = StoryObj<typeof meta>

export const Static: Story = {}

export const Expanded: Story = {
  args: {
    collapsible: false,
  },
}

export const Collapsed: Story = {
  args: {
    collapsible: true,
  },
}
