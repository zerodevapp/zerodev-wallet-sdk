import type { Meta, StoryObj } from '@storybook/react-vite'

import { Icon } from '../Icon'
import { Text } from '../Text'
import { DataRow, DataRowSkeleton } from './index'

const meta = {
  title: 'DataRow',
  component: DataRow,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onInfoClick: { action: 'info-clicked' },
  },
  args: {
    label: 'Max slippage',
    value: '0.50%',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 344 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DataRow>

export default meta
type Story = StoryObj<typeof meta>

/** Plain row — label on the left, value on the right. */
export const Default: Story = {}

/** With the inline info icon between label and value. */
export const WithInfoIcon: Story = {
  args: {
    label: 'Max slippage',
    value: '0.50%',
    info: true,
  },
}

/** With an interactive info button (keyboard-accessible; fires `onInfoClick`). */
export const WithInteractiveInfo: Story = {
  args: {
    label: 'Ready in',
    value: '≈ 3 min',
    info: true,
    onInfoClick: () => {},
  },
}

/** With a trailing chevron for expandable rows. */
export const WithTrailingIcon: Story = {
  args: {
    label: 'Estimated fee',
    value: '0.74%',
    info: true,
    trailing: (
      <Icon
        name="chevronDown"
        className="zd:w-3.5 zd:h-3.5 zd:text-greyScale"
      />
    ),
  },
}

/** With a leading warning icon before the value (solarOrange). */
export const WithLeadingIcon: Story = {
  args: {
    label: 'Fee',
    value: '0.0012 ETH',
    leading: (
      <Icon name="warning" className="zd:w-3 zd:h-3 zd:text-solarOrange" />
    ),
  },
}

/** With leading + trailing icons together (e.g. gas fee with a status hint). */
export const WithLeadingAndTrailingIcons: Story = {
  args: {
    label: 'Fee',
    value: '0.0012 ETH ($3.50)',
    leading: (
      <Icon name="warning" className="zd:w-3 zd:h-3 zd:text-solarOrange" />
    ),
    trailing: (
      <Icon
        name="gasStation"
        className="zd:w-3.5 zd:h-3.5 zd:text-solarOrange"
      />
    ),
  },
}

/** Value slot accepts arbitrary ReactNode (rendered verbatim, no Text wrapping). */
export const WithCustomValue: Story = {
  args: {
    label: 'Status',
    value: <Text className="zd:text-solarOrange">Pending</Text>,
  },
}

/**
 * Warning variant — the orange-tinted card treatment used for the "Minimum
 * deposit" row in the SRA "Deposit funds" flow.
 */
export const Warning: Story = {
  args: {
    label: 'Minimum deposit',
    value: '27.88 USDC',
    info: true,
    variant: 'warning',
  },
}

/** Pulse-placeholder loading state. */
export const Skeleton: StoryObj<typeof DataRowSkeleton> = {
  render: () => <DataRowSkeleton />,
}

/** Skeleton with the label rendered as-is on the left. */
export const SkeletonWithLabel: StoryObj<typeof DataRowSkeleton> = {
  render: () => <DataRowSkeleton label="Fee" />,
}
