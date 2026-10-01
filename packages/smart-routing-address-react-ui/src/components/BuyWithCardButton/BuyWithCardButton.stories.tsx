import type { Meta, StoryObj } from '@storybook/react-vite'
import { Screen } from '@zerodev/react-ui'
import { BuyWithCardButton } from './index'

const meta: Meta<typeof BuyWithCardButton> = {
  title: 'SmartRoutingAddress/BuyWithCardButton',
  component: BuyWithCardButton,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      // Render inside the real SRA `Screen` chrome so the translucent
      // white@0.5 surface and the white payment chips read like production.
      <Screen size="lg">
        <Story />
      </Screen>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Disabled: Story = {
  args: { disabled: true },
}
