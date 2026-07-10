import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import {
  SelectDropdown,
  type SelectDropdownItem,
  type SelectDropdownProps,
} from './index'

const TOKENS: SelectDropdownItem[] = [
  {
    id: 'USDC',
    symbol: 'USDC',
    subtitle: '13 networks',
    logoBg: '#2775CA',
    logoInitial: 'U',
    badge: 'Recommended',
  },
  {
    id: 'WETH',
    symbol: 'WETH',
    subtitle: '11 networks',
    logoBg: '#627EEA',
    logoInitial: 'W',
  },
  {
    id: 'USDT',
    symbol: 'USDT',
    subtitle: '9 networks',
    logoBg: '#26A17B',
    logoInitial: 'T',
  },
  {
    id: 'DAI',
    symbol: 'DAI',
    subtitle: '1 network',
    logoBg: '#F4B731',
    logoInitial: 'D',
  },
  {
    id: 'WBTC',
    symbol: 'WBTC',
    subtitle: '6 networks',
    logoBg: '#F09242',
    logoInitial: 'W',
  },
]

const meta: Meta<typeof SelectDropdown> = {
  title: 'SelectDropdown',
  component: SelectDropdown,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      // Trigger width mirrors Figma's 162px pill; the caller normally sits
      // the SelectDropdown inside a wider parent when it needs the panel to
      // span more than the pill.
      <div style={{ width: 162 }}>
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

function Controlled(props: Omit<SelectDropdownProps, 'value' | 'onChange'>) {
  const [value, setValue] = useState('USDC')
  return <SelectDropdown {...props} value={value} onChange={setValue} />
}

/** Default token dropdown — click the pill to open the list. */
export const Default: Story = {
  render: () => <Controlled items={TOKENS} />,
}

/** Wider panel, useful when the SelectDropdown sits next to another pill and
 * the caller wants the list to span the whole row. */
export const WidePanel: Story = {
  render: () => <Controlled items={TOKENS} panelClassName="zd:w-80" />,
}

/** Disabled trigger — no chevron, no click handler. */
export const Disabled: Story = {
  render: () => (
    <SelectDropdown items={TOKENS} value="USDC" onChange={() => {}} disabled />
  ),
}
