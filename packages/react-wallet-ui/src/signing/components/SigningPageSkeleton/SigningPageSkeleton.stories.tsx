import type { Meta, StoryObj } from '@storybook/react-vite'

import { SigningPageSkeleton } from '.'

const meta = {
  title: 'Signing/SigningPageSkeleton',
  component: SigningPageSkeleton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: 400 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SigningPageSkeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
