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
} satisfies Meta<typeof Wrapper>

export default meta
type Story = StoryObj<typeof meta>

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    className: 'zd:rounded-2xl zd:p-6',
    children: (
      <p className="zd:text-gray-900 zd:text-base zd:font-medium">
        Ghost variant — most transparent (α 0.2)
      </p>
    ),
  },
}

export const Soft: Story = {
  args: {
    variant: 'soft',
    className: 'zd:rounded-2xl zd:p-6',
    children: (
      <p className="zd:text-gray-900 zd:text-base zd:font-medium">
        Soft variant — default (α 0.4)
      </p>
    ),
  },
}

export const Solid: Story = {
  args: {
    variant: 'solid',
    className: 'zd:rounded-2xl zd:p-6',
    children: (
      <p className="zd:text-gray-900 zd:text-base zd:font-medium">
        Solid variant — most opaque (α 0.8)
      </p>
    ),
  },
}

export const AllVariants: Story = {
  render: () => (
    <div className="zd:flex zd:flex-col zd:gap-4 zd:w-80">
      <Wrapper variant="ghost" className="zd:rounded-2xl zd:p-6">
        <p className="zd:text-gray-900 zd:text-base zd:font-medium">
          Ghost (α 0.2)
        </p>
      </Wrapper>
      <Wrapper variant="soft" className="zd:rounded-2xl zd:p-6">
        <p className="zd:text-gray-900 zd:text-base zd:font-medium">
          Soft (α 0.4)
        </p>
      </Wrapper>
      <Wrapper variant="solid" className="zd:rounded-2xl zd:p-6">
        <p className="zd:text-gray-900 zd:text-base zd:font-medium">
          Solid (α 0.8)
        </p>
      </Wrapper>
    </div>
  ),
}

export const WithRichContent: Story = {
  render: () => (
    <Wrapper variant="soft" className="zd:rounded-2xl zd:p-6 zd:w-80">
      <div className="zd:flex zd:flex-col zd:gap-2">
        <h3 className="zd:text-gray-900 zd:text-lg zd:font-semibold">
          Wallet Balance
        </h3>
        <p className="zd:text-gray-700 zd:text-sm">
          Your current balance across all chains
        </p>
        <p className="zd:text-gray-900 zd:text-2xl zd:font-bold">$1,234.56</p>
      </div>
    </Wrapper>
  ),
}
