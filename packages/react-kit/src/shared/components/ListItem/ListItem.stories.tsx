import type { Meta, StoryObj } from '@storybook/react-vite'

import { ListItem, ListItemSkeleton } from './index'

const meta = {
  title: 'Shared/ListItem',
  component: ListItem,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    iconName: {
      control: 'text',
      description: 'Icon name to display',
    },
    imageUri: {
      control: 'text',
      description: 'Image URI to display',
    },
    title: {
      control: 'text',
      description: 'Main title text',
    },
    subtitle: {
      control: 'text',
      description: 'Subtitle text',
    },
    chevron: {
      control: 'boolean',
      description: 'Show chevron icon',
    },
    alert: {
      control: 'boolean',
      description: 'Alert styling',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ListItem>

export default meta
type Story = StoryObj<typeof meta>

export const WithIcon: Story = {
  args: {
    iconName: 'wallet',
    title: 'Wallet',
    subtitle: 'Connected',
    chevron: true,
  },
}

export const WithDetails: Story = {
  args: {
    iconName: 'wallet',
    title: 'Transaction',
    subtitle: 'Pending',
    details: {
      text: '$100.00',
      subtext: 'USD',
    },
  },
}

export const AlertState: Story = {
  args: {
    iconName: 'warning',
    title: 'Action Required',
    subtitle: 'Review transaction',
    alert: true,
    chevron: true,
  },
}

export const Skeleton: StoryObj<typeof ListItemSkeleton> = {
  render: () => <ListItemSkeleton />,
}
