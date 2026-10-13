import type { Meta, StoryObj } from '@storybook/react-vite'
import { DataApiError } from '@zerodev/wallet-data'
import { expect, fn, userEvent, within } from 'storybook/test'
import { SCENARIOS } from '../__stories__'
import { longHistoryPages } from '../__stories__/longHistory'
import {
  type ScenarioFeedOptions,
  useScenarioFeed,
} from '../__stories__/storyFeed'
import { TxHistoryView } from './TxHistoryView'

const pages = longHistoryPages(Date.now())

function ScenarioView(options: ScenarioFeedOptions) {
  return <TxHistoryView feed={useScenarioFeed(options)} onClose={fn()} />
}

const meta = {
  title: 'History/TxHistoryView',
  component: TxHistoryView,
  parameters: { layout: 'centered' },
  globals: { screen: 'off' },
  args: { feed: { status: 'loading' }, onClose: fn() },
  decorators: [
    (Story) => (
      <div style={{ width: 420, height: 680 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TxHistoryView>

export default meta
type Story = StoryObj<typeof meta>

export const AllOperations: Story = {
  render: () => <ScenarioView pages={[SCENARIOS.allOperations]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText('Sent USDC'))
    await expect(canvas.getAllByText('Transaction details')).toHaveLength(2)
    const [back] = canvas.getAllByRole('button')
    if (!back) throw new Error('Back button not rendered')
    await userEvent.click(back)
    await expect(canvas.getByText('History')).toBeInTheDocument()
  },
}

export const Statuses: Story = {
  render: () => <ScenarioView pages={[SCENARIOS.statuses]} />,
}

export const Unparsed: Story = {
  render: () => <ScenarioView pages={[SCENARIOS.unparsed]} />,
}

export const TokenGaps: Story = {
  render: () => <ScenarioView pages={[SCENARIOS.tokenGaps]} />,
}

export const Fees: Story = {
  render: () => <ScenarioView pages={[SCENARIOS.fees]} />,
}

export const Chains: Story = {
  render: () => <ScenarioView pages={[SCENARIOS.chains]} />,
}

export const Testnet: Story = {
  render: () => <ScenarioView pages={[SCENARIOS.testnet]} />,
}

export const Formatting: Story = {
  render: () => <ScenarioView pages={[SCENARIOS.formatting]} />,
}

export const Empty: Story = {
  render: () => <ScenarioView pages={[[]]} />,
}

export const Loading: Story = {}

export const ErrorState: Story = {
  name: 'Error',
  render: () => (
    <ScenarioView
      pages={[SCENARIOS.allOperations]}
      failWith={
        new DataApiError({
          status: 502,
          body: null,
          url: 'https://data.example/v1/transactions',
        })
      }
    />
  ),
}

export const LongHistory: Story = {
  render: () => <ScenarioView pages={pages} />,
}
