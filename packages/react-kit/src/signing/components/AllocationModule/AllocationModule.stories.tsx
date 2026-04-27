import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { AllocationModule } from '.'

const meta = {
  title: 'Signing/AllocationModule',
  component: AllocationModule,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    token: {
      symbol: 'ETH',
      network: 'ethereum',
      imageSource: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    },
    availableAmount: 1.5,
    checked: true,
    onCheck: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AllocationModule>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => {
    const [checked, setChecked] = useState(args.checked)
    return (
      <AllocationModule
        {...args}
        checked={checked}
        onCheck={() => {
          setChecked((c) => !c)
        }}
      />
    )
  },
}
