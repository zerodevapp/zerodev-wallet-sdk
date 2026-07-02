import type { Meta, StoryObj } from '@storybook/react-vite'

import { icons, Text } from '@zerodev/react-ui'
import { DataRow, DataRowSkeleton } from '.'

const iconNames = Object.keys(icons)

const meta = {
  title: 'Signing/DataRow',
  component: DataRow,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    iconName: {
      control: 'select',
      options: [undefined, ...iconNames],
    },
    leadingIconName: {
      control: 'select',
      options: [undefined, ...iconNames],
    },
  },
  args: {
    label: 'amount',
    value: '0.05 ETH',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DataRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const CamelCaseLabel: Story = {
  args: {
    label: 'gasFee',
    value: '0.00123 ETH',
  },
}

export const WithLeadingIcon: Story = {
  args: {
    label: 'gas',
    value: '0.0012 ETH',
    leadingIconName: 'flame',
  },
}

export const WithTrailingIcon: Story = {
  args: {
    label: 'network',
    value: 'Sepolia',
    iconName: 'info',
  },
}

export const WithCustomValue: Story = {
  args: {
    label: 'status',
    value: <Text className="zd:text-solarOrange">Pending</Text>,
  },
}

export const Skeleton: StoryObj<typeof DataRowSkeleton> = {
  render: () => <DataRowSkeleton />,
}
