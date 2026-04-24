import type { Meta, StoryObj } from '@storybook/react-vite'

import { icons } from '../../../shared/components/Icon'
import { Text } from '../../../shared/components/Text'
import { DetailsContainer } from '.'

const iconNames = Object.keys(icons)

const meta = {
  title: 'Signing/DetailsContainer',
  component: DetailsContainer,
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
      <div className="flex flex-col gap-2">
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
} satisfies Meta<typeof DetailsContainer>

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
