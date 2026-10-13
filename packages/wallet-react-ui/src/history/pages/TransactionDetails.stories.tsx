import type { Meta, StoryObj } from '@storybook/react-vite'
import type { TransactionHistoryTransaction } from '@zerodev/wallet-data'
import { SCENARIOS } from '../__stories__'
import { withRealScreen } from '../__stories__/storyScreen'
import { TransactionDetails } from './TransactionDetails'

function transaction(n: number): TransactionHistoryTransaction {
  const found = Object.values(SCENARIOS)
    .flat()
    .find((item) => !('kind' in item) && item.id === `tx-${n}`)
  if (!found || 'kind' in found) throw new Error(`No scenario tx-${n}`)
  return found
}

const meta = {
  title: 'History/TransactionDetails',
  component: TransactionDetails,
  parameters: { layout: 'centered' },
  globals: { screen: 'off' },
  args: { transaction: transaction(113) },
  decorators: [withRealScreen('Transaction details')],
} satisfies Meta<typeof TransactionDetails>

export default meta
type Story = StoryObj<typeof meta>

export const TwoSidedSwap: Story = {}

export const OneSidedSwap: Story = { args: { transaction: transaction(114) } }

export const NftMint: Story = { args: { transaction: transaction(108) } }

export const ProtocolFees: Story = { args: { transaction: transaction(503) } }

export const NetworkFeeWithoutPrice: Story = {
  args: { transaction: transaction(501) },
}

export const NoExplorerUrl: Story = { args: { transaction: transaction(600) } }

export const TokenWithoutSymbol: Story = {
  args: { transaction: transaction(400) },
}

export const TokenWithoutPrice: Story = {
  args: { transaction: transaction(402) },
}

export const Pending: Story = { args: { transaction: transaction(200) } }

export const Success: Story = { args: { transaction: transaction(201) } }

export const Failed: Story = { args: { transaction: transaction(202) } }

export const Unknown: Story = { args: { transaction: transaction(203) } }
