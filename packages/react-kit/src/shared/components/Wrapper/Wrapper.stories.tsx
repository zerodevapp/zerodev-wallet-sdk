import type { Meta, StoryObj } from '@storybook/react-vite'

import { Wrapper } from '.'

const meta = {
  title: 'Shared/Wrapper',
  component: Wrapper,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['ghost', 'soft', 'solid'],
    },
  },
  args: {
    variant: 'soft',
  },
  decorators: [
    (Story) => (
      <div
        className="p-10"
        style={{
          backgroundImage: 'linear-gradient(135deg, #B78C71 0%, #45ABFB 100%)',
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Wrapper>

export default meta
type Story = StoryObj<typeof meta>

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    className: 'rounded-2xl p-6',
    children: (
      <p className="text-gray-900 text-base font-medium">
        Ghost variant — most transparent (α 0.2)
      </p>
    ),
  },
}

export const Soft: Story = {
  args: {
    variant: 'soft',
    className: 'rounded-2xl p-6',
    children: (
      <p className="text-gray-900 text-base font-medium">
        Soft variant — default (α 0.4)
      </p>
    ),
  },
}

export const Solid: Story = {
  args: {
    variant: 'solid',
    className: 'rounded-2xl p-6',
    children: (
      <p className="text-gray-900 text-base font-medium">
        Solid variant — most opaque (α 0.8)
      </p>
    ),
  },
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-80">
      <Wrapper variant="ghost" className="rounded-2xl p-6">
        <p className="text-gray-900 text-base font-medium">Ghost (α 0.2)</p>
      </Wrapper>
      <Wrapper variant="soft" className="rounded-2xl p-6">
        <p className="text-gray-900 text-base font-medium">Soft (α 0.4)</p>
      </Wrapper>
      <Wrapper variant="solid" className="rounded-2xl p-6">
        <p className="text-gray-900 text-base font-medium">Solid (α 0.8)</p>
      </Wrapper>
    </div>
  ),
}

export const WithRichContent: Story = {
  render: () => (
    <Wrapper variant="soft" className="rounded-2xl p-6 w-80">
      <div className="flex flex-col gap-2">
        <h3 className="text-gray-900 text-lg font-semibold">Wallet Balance</h3>
        <p className="text-gray-700 text-sm">
          Your current balance across all chains
        </p>
        <p className="text-gray-900 text-2xl font-bold">$1,234.56</p>
      </div>
    </Wrapper>
  ),
}
