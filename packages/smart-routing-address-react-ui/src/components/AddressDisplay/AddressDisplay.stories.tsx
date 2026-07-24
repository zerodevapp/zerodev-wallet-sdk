import type { Meta, StoryObj } from '@storybook/react-vite'
import { AddressDisplayUI } from './index'

const meta: Meta<typeof AddressDisplayUI> = {
  title: 'SmartRoutingAddress/AddressDisplayUI',
  component: AddressDisplayUI,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div style={{ width: 368 }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    onQrClick: { action: 'qr-clicked' },
  },
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Loading variant — matches Figma 17634:104343 ("Smart Funding" card).
 * Rendered while the parent is watching for a deposit at the generated
 * address.
 */
export const LoadingWatching: Story = {
  args: {
    loadingText: 'Watching for your deposit on Base…',
  },
}

/**
 * Same loading variant, used earlier in the flow while the SRA server is
 * still generating the deposit address itself.
 */
export const LoadingGenerating: Story = {
  args: {
    loadingText: 'Generating deposit address…',
  },
}

/**
 * Ready variant — matches Figma 17762:78875. Shows the full deposit address
 * on the left and a 52×52 white QR button on the right.
 */
export const Ready: Story = {
  args: {
    address: '0x8f527b33CD7c791aEDe7EbA077140D81A0000001',
    onQrClick: () => {},
  },
}
