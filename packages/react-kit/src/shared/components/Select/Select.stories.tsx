import type { Meta, StoryObj } from '@storybook/react-vite'

import { Select } from '.'

const meta = {
  title: 'Shared/Select',
  component: Select,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: 240 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    label: 'Token',
  },
}

export const WithLeadingImageAndChain: Story = {
  args: {
    label: 'Token',
    subtitle: 'Arbitrum',
    leadingImage:
      'https://img.icons8.com/external-black-fill-lafs/64/external-USDC-cryptocurrency-black-fill-lafs.png',
    chainImage: 'https://img.icons8.com/color/1200/ethereum.jpg',
  },
}

export const NoTrailingIcon: Story = {
  args: {
    label: 'Token',
    trailingIcon: false,
  },
}

export const Disabled: Story = {
  args: {
    label: 'Token',
    disabled: true,
  },
}

export const Loading: Story = {
  args: {
    label: '',
    loading: true,
  },
}
