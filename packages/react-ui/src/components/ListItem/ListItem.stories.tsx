import type { Meta, StoryObj } from '@storybook/react-vite'

import { Badge } from '../Badge'
import { Text } from '../Text'
import {
  ListItem,
  ListItemChevron,
  ListItemIcon,
  ListItemSkeleton,
} from './index'

const meta = {
  title: 'Shared/ListItem',
  component: ListItem,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    title: {
      control: 'text',
      description: 'Main title text',
    },
    subtitle: {
      control: 'text',
      description: 'Subtitle text',
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
    icon: <ListItemIcon name="wallet" />,
    title: 'Wallet',
    subtitle: 'Connected',
    trailing: <ListItemChevron />,
  },
}

export const WithDetails: Story = {
  args: {
    icon: <ListItemIcon name="wallet" className="zd:text-solarOrange" />,
    title: 'Transaction',
    subtitle: 'Pending',
    trailing: (
      <div className="zd:flex zd:flex-col zd:pr-1">
        <Text className="zd:text-body1">$100.00</Text>
        <Text className="zd:text-body3 zd:text-greyScale/50 zd:self-end">
          USD
        </Text>
      </div>
    ),
  },
}

export const WithBadge: Story = {
  args: {
    icon: <ListItemIcon name="wallet" />,
    title: 'Verified Wallet',
    subtitle: <Badge text="Verified" variant="secondary" leadingIcon="check" />,
    trailing: <ListItemChevron />,
  },
}

export const AsLink: Story = {
  args: {
    icon: <ListItemIcon name="wallet" />,
    title: 'Get MetaMask',
    trailing: <ListItemChevron />,
    asChild: true,
    children: (
      // biome-ignore lint/a11y/useAnchorContent: the row layout (incl. the title text) is injected into the anchor via Slot
      <a href="https://metamask.io" target="_blank" rel="noreferrer" />
    ),
  },
}

export const Skeleton: StoryObj<typeof ListItemSkeleton> = {
  render: () => <ListItemSkeleton />,
}
