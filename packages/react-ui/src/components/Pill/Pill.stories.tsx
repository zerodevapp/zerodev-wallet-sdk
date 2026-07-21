import type { Meta, StoryObj } from '@storybook/react-vite'
import { Icon } from '../Icon'
import { Pill } from './index'

const meta: Meta<typeof Pill> = {
  title: 'Pill',
  component: Pill,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div style={{ width: 162 }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    onClick: { action: 'clicked' },
  },
}

export default meta
type Story = StoryObj<typeof meta>

/** Interactive variant with a trailing chevron affordance. Keyboard-accessible
 * (Enter/Space trigger `onClick`). */
export const Interactive: Story = {
  args: {
    label: 'USDC',
    onClick: () => {},
    trailingIcon: (
      <Icon name="chevronDown" className="zd:size-4 zd:text-greyScale" />
    ),
  },
}

/** Second interactive example with a different label. */
export const InteractiveChain: Story = {
  args: {
    label: 'Base',
    onClick: () => {},
    trailingIcon: (
      <Icon name="chevronDown" className="zd:size-4 zd:text-greyScale" />
    ),
  },
}

/** Display variant — no trailing icon, no click handler. */
export const Display: Story = {
  args: {
    label: 'Arbitrum One',
  },
}

/** `disabled` forces a passed `onClick` to be ignored — useful for
 * "temporarily unavailable" states. */
export const DisplayForcedDisabled: Story = {
  args: {
    label: 'Arbitrum One',
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
    trailingIcon: (
      <Icon name="chevronDown" className="zd:size-4 zd:text-greyScale" />
    ),
  },
}

/** Loading skeleton — renders when `loading` is true, mirroring the pill's
 * footprint with a pulsing disc + label bar. */
export const Loading: Story = {
  args: {
    label: '',
    loading: true,
  },
}
