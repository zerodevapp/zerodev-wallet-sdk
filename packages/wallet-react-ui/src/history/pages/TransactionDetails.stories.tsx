import type { Meta, StoryObj } from '@storybook/react-vite'
import { TRANSACTION_HISTORY_TRANSACTION_FIXTURES as GOLDEN } from '@zerodev/wallet-data/fixtures'
import { withRealScreen } from '../__stories__/storyScreen'
import { TransactionDetails } from './TransactionDetails'

const meta = {
  title: 'History/TransactionDetails',
  component: TransactionDetails,
  parameters: { layout: 'centered' },
  globals: { screen: 'off' },
  args: { transaction: GOLDEN.swapTwoSided },
  decorators: [withRealScreen('Transaction details')],
} satisfies Meta<typeof TransactionDetails>

export default meta
type Story = StoryObj<typeof meta>

export const TwoSidedSwap: Story = {}

export const OneSidedSwap: Story = {
  args: { transaction: GOLDEN.swapOutOnly },
}

export const SwapNftForToken: Story = {
  args: { transaction: GOLDEN.swapNftForToken },
}

export const SwapNftForNft: Story = {
  args: { transaction: GOLDEN.swapNftForNft },
}

export const NftMint: Story = { args: { transaction: GOLDEN.mint } }

export const NftMintInQuantity: Story = {
  args: { transaction: GOLDEN.mintNftQuantity },
}

export const NftReceive: Story = { args: { transaction: GOLDEN.nftReceive } }

export const NftLongTokenId: Story = {
  args: { transaction: GOLDEN.withdrawNftReceipt },
}

export const ApproveUnlimited: Story = {
  args: { transaction: GOLDEN.approveUnlimited },
}

export const ApproveCollection: Story = {
  args: { transaction: GOLDEN.approveCollection },
}

export const Revoke: Story = { args: { transaction: GOLDEN.revoke } }

export const SelfSend: Story = { args: { transaction: GOLDEN.selfSend } }

export const Deploy: Story = { args: { transaction: GOLDEN.deploy } }

export const ProtocolFees: Story = {
  args: { transaction: GOLDEN.feesWithProtocol },
}

export const FeesNonUiAct: Story = {
  args: { transaction: GOLDEN.feesNonUiAct },
}

export const NoExplorerUrl: Story = {
  args: { transaction: GOLDEN.chainNoExplorer },
}

export const TokenWithoutSymbol: Story = {
  args: { transaction: GOLDEN.tokenNoSymbol },
}

export const TokenWithoutPrice: Story = {
  args: { transaction: GOLDEN.tokenNoPrice },
}

export const Pending: Story = { args: { transaction: GOLDEN.statusPending } }

export const Success: Story = { args: { transaction: GOLDEN.send } }

export const Failed: Story = { args: { transaction: GOLDEN.statusFailed } }

export const Unknown: Story = { args: { transaction: GOLDEN.statusUnknown } }
