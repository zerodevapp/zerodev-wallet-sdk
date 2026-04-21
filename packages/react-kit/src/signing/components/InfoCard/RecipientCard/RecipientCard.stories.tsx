import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { RecipientCard } from '.'

const SAVED_ADDRESS =
  '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`
const UNKNOWN_ADDRESS =
  '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`

const savedClient = new QueryClient()
savedClient.setQueryData(
  ['contacts'],
  [{ name: 'Alice', address: SAVED_ADDRESS }],
)

const emptyClient = new QueryClient()

const meta = {
  title: 'Signing/RecipientCard',
  component: RecipientCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RecipientCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { address: UNKNOWN_ADDRESS },
  decorators: [
    (Story) => (
      <QueryClientProvider client={emptyClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
}
