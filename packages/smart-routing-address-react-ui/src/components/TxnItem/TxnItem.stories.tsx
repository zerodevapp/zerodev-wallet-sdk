import type { Meta, StoryObj } from '@storybook/react-vite'
import { Screen } from '@zerodev/react-ui'
import { CHAIN_ICONS, TOKEN_ICONS } from '../../iconAssets'
import { TxnItem } from './index'

const meta: Meta<typeof TxnItem> = {
  title: 'SmartRoutingAddress/TxnItem',
  component: TxnItem,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      // Render inside the real SRA `Screen` chrome (amorphic gradient +
      // translucent card surfaces) so the row's colors, text tint, and
      // pair-mark badges read exactly like they will in production.
      <Screen size="lg">
        <Story />
      </Screen>
    ),
  ],
  argTypes: {
    status: {
      control: 'select',
      options: ['Routing', 'Detected', 'Received', 'Failed'],
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

// Base scenario: USDT on Arbitrum → USDC on Base. Both the token AND the
// chain differ between source and destination so the two overlapping
// pair-marks read distinctly left-to-right as "from → to".
const BASE_ARGS = {
  amount: '$248.00 USD',
  address: '0x4d2a…ba99',
  href: 'https://basescan.org/tx/0x4d2a0000000000000000000000000000000000000000000000000000000000ba99',
  timestamp: '2 mo ago',
  sourceTokenIconUrl: TOKEN_ICONS.USDT,
  sourceChainIconUrl: CHAIN_ICONS[42161], // arbitrum
  destTokenIconUrl: TOKEN_ICONS.USDC,
  destChainIconUrl: CHAIN_ICONS[8453], // base
} as const

/** Terminal success state — green label. */
export const Received: Story = {
  args: { ...BASE_ARGS, status: 'Received' },
}

/** Deposit seen on the source chain, waiting to be picked up for routing. */
export const Detected: Story = {
  args: { ...BASE_ARGS, status: 'Detected' },
}

/** Actively bridging across chains — brand-orange to signal in-progress work. */
export const Routing: Story = {
  args: { ...BASE_ARGS, status: 'Routing' },
}

/** Terminal failure state — red label. */
export const Failed: Story = {
  args: { ...BASE_ARGS, status: 'Failed' },
}

/** Cross-token route: WETH on Optimism → USDC on Arbitrum. */
export const CrossToken: Story = {
  args: {
    amount: '$1,204.55 USD',
    address: '0x88af…3c21',
    href: 'https://arbiscan.io/tx/0x88af',
    timestamp: '12 min ago',
    status: 'Received',
    sourceTokenIconUrl: TOKEN_ICONS.WETH,
    sourceChainIconUrl: CHAIN_ICONS[10], // optimism
    destTokenIconUrl: TOKEN_ICONS.USDC,
    destChainIconUrl: CHAIN_ICONS[42161], // arbitrum
  },
}

/** No `href` supplied → address renders as plain text without the external
 * arrow. Useful when the block explorer URL isn't resolvable. */
export const NoExplorerLink: Story = {
  args: {
    amount: '$248.00 USD',
    address: '0x4d2a…ba99',
    timestamp: '2 mo ago',
    status: 'Received',
    sourceTokenIconUrl: TOKEN_ICONS.USDT,
    sourceChainIconUrl: CHAIN_ICONS[42161],
    destTokenIconUrl: TOKEN_ICONS.USDC,
    destChainIconUrl: CHAIN_ICONS[8453],
  },
}

/** No icons supplied → placeholder discs render in their slots. Demonstrates
 * the graceful-degradation path for tokens/chains not in the icon map. */
export const NoIcons: Story = {
  args: {
    amount: '$248.00 USD',
    address: '0x4d2a…ba99',
    href: 'https://arbiscan.io/tx/0x…',
    timestamp: '2 mo ago',
    status: 'Received',
  },
}
