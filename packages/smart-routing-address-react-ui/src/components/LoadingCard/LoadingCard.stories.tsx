import type { Meta, StoryObj } from '@storybook/react-vite'
import { LoadingCard } from './index'

const meta: Meta<typeof LoadingCard> = {
  title: 'SmartRoutingAddress/LoadingCard',
  component: LoadingCard,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div style={{ width: 368 }}>
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

/** Used inside `AddressDisplay`'s loading variant while the SRA server
 * is generating the deposit address. */
export const GeneratingAddress: Story = {
  args: {
    text: 'Generating deposit address…',
  },
}

/** Used inside `SmartFunding` while the app is watching for an incoming
 * deposit at the generated address. */
export const WatchingForDeposit: Story = {
  args: {
    text: 'Watching for your deposit on Base…',
  },
}
