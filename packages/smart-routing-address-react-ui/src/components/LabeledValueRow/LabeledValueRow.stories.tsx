import type { Meta, StoryObj } from '@storybook/react-vite'
import { Icon } from '@zerodev/react-ui'
import { LabeledValueRow } from './index'

const meta: Meta<typeof LabeledValueRow> = {
  title: 'SmartRoutingAddress/LabeledValueRow',
  component: LabeledValueRow,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div style={{ width: 344 }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    onInfoClick: { action: 'info-clicked' },
  },
}

export default meta
type Story = StoryObj<typeof meta>

/** Default variant — Figma 17634:104295 ("Max slippage — 0.50%"). */
export const Slippage: Story = {
  args: {
    label: 'Max slippage',
    value: '0.50%',
    info: true,
  },
}

/** Ready-in row — Figma 17634:104320. Same shape as Slippage. */
export const ReadyIn: Story = {
  args: {
    label: 'Ready in',
    value: '≈ 3 min',
    info: true,
  },
}

/**
 * Expandable variant — Figma 17634:104304 ("Estimated fee — 0.74% ⌄").
 * Same as default but with a chevron passed via `trailing`.
 */
export const Expandable: Story = {
  args: {
    label: 'Estimated fee',
    value: '0.74%',
    info: true,
    trailing: (
      <Icon name="chevronDown" className="zd:size-3.5 zd:text-greyScale" />
    ),
  },
}

/**
 * Warning variant — Figma 18210:75228 ("Minimum deposit — 27.88 USDC").
 * Orange-tinted card treatment with border, backdrop blur, and inner shadow.
 */
export const Warning: Story = {
  args: {
    label: 'Minimum deposit',
    value: '27.88 USDC',
    info: true,
    variant: 'warning',
  },
}
