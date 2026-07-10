import type { Meta, StoryObj } from '@storybook/react-vite'
import { PillItem } from './index'

const meta: Meta<typeof PillItem> = {
  title: 'PillItem',
  component: PillItem,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div style={{ width: 162 }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    logoBg: { control: 'color' },
    onClick: { action: 'clicked' },
  },
}

export default meta
type Story = StoryObj<typeof meta>

/** Interactive variant — the default. Renders a chevron and is
 * keyboard-accessible (Enter/Space trigger `onClick`). */
export const Interactive: Story = {
  args: {
    label: 'USDC',
    logoBg: '#2775CA',
    onClick: () => {},
  },
}

/** Second interactive example with a different label/logo. */
export const InteractiveChain: Story = {
  args: {
    label: 'Base',
    logoBg: '#0052FF',
    onClick: () => {},
  },
}

/**
 * Display variant — renders on a 5% white surface with no chevron. Achieved
 * by omitting `onClick`; setting `disabled: true` alongside an `onClick`
 * handler produces the same visual.
 */
export const Display: Story = {
  args: {
    label: 'Arbitrum One',
    logoBg: '#28A0F0',
  },
}

/** Same display variant, but with `disabled: true` forcing a passed
 * `onClick` handler to be ignored — useful for "temporarily unavailable"
 * states without unmounting/remounting props. */
export const DisplayForcedDisabled: Story = {
  args: {
    label: 'Arbitrum One',
    logoBg: '#28A0F0',
    onClick: () => {},
    disabled: true,
  },
}

/** With an external logo image supplied. */
export const WithLogoImage: Story = {
  args: {
    label: 'USDC',
    logoUri:
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    onClick: () => {},
  },
}
