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
    logoBg: { control: 'color' },
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
    logoBg: '#2775CA',
    onClick: () => {},
    trailingIcon: (
      <Icon name="chevronDown" className="zd:size-4 zd:text-greyScale" />
    ),
  },
}

/** Second interactive example with a different label/logo. */
export const InteractiveChain: Story = {
  args: {
    label: 'Base',
    logoBg: '#0052FF',
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
    logoBg: '#28A0F0',
  },
}

/** `disabled` forces a passed `onClick` to be ignored — useful for
 * "temporarily unavailable" states. */
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
    trailingIcon: (
      <Icon name="chevronDown" className="zd:size-4 zd:text-greyScale" />
    ),
  },
}
