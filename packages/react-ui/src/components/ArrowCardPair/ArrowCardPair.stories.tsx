import type { Meta, StoryObj } from '@storybook/react-vite'

import { Text } from '../Text'
import { Wrapper } from '../Wrapper'
import { ArrowCardPair } from '.'

const meta: Meta<typeof ArrowCardPair> = {
  title: 'Layout/ArrowCardPair',
  component: ArrowCardPair,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Two cards with a chevron-down arrow floating between them, and rounded
 * notches clipped out of each card where the arrow sits. Used to visually
 * connect a "from" and "to" side of a swap, transfer, or deposit flow.
 */
export const Default: Story = {
  args: {
    topCard: (
      <Wrapper variant="ghost" className="zd:rounded-2xl zd:p-4 zd:bg-red-600">
        <Text className="zd:text-h3">Top card</Text>
      </Wrapper>
    ),
    bottomCard: (
      <Wrapper variant="ghost" className="zd:rounded-2xl zd:p-4 zd:bg-red-950">
        <Text className="zd:text-h3">Bottom card</Text>
      </Wrapper>
    ),
  },
}
