import type { Meta, StoryObj } from '@storybook/react-vite'

import { type GasFee, TxGasFees, TxGasFeesSkeleton } from '.'

const gasFees: GasFee[] = [
  { tier: 'low', duration: 120, fee: '0.0001 ETH', feeUsd: '$0.30' },
  { tier: 'market', duration: 30, fee: '0.0005 ETH', feeUsd: '$1.50' },
  { tier: 'fast', duration: 10, fee: '0.001 ETH', feeUsd: '$3.00' },
]

const meta = {
  title: 'Signing/TxGasFees',
  component: TxGasFees,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    selectedGasTier: {
      control: 'radio',
      options: ['low', 'market', 'fast'],
    },
    slippage: {
      control: { type: 'number', min: 0, max: 10, step: 0.1 },
    },
  },
  args: {
    selectedGasTier: 'market',
    gasFees,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 400 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TxGasFees>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LowTier: Story = {
  args: {
    selectedGasTier: 'low',
  },
}

export const FastTier: Story = {
  args: {
    selectedGasTier: 'fast',
  },
}

export const WithSlippage: Story = {
  args: {
    slippage: 0.5,
  },
}

export const Skeleton: StoryObj<typeof TxGasFeesSkeleton> = {
  render: () => <TxGasFeesSkeleton />,
}
