import type { Meta, StoryObj } from '@storybook/react-vite'

import { TokenSummary } from './index'

const ETH_ICON =
  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png'

const meta = {
  title: 'TokenSummary',
  component: TokenSummary,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: 352 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TokenSummary>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    primaryValue: '+$170.27',
    secondaryValue: '0.0652 ETH',
    tokenLogoUrl: ETH_ICON,
  },
}
