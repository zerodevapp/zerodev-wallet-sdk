import type { Meta, StoryObj } from '@storybook/react-vite'
import type { TransactionHistoryItem } from '@zerodev/wallet-data'
import { DataApiError } from '@zerodev/wallet-data'
import { expect, fn, userEvent, within } from 'storybook/test'
import { SCENARIOS } from '../__stories__'
import { longHistoryPages } from '../__stories__/longHistory'
import {
  type ScenarioFeedOptions,
  useScenarioFeed,
} from '../__stories__/storyFeed'
import { withRealScreen } from '../__stories__/storyScreen'
import type { HistoryFeed } from '../types'
import { toTxHistoryEntry } from '../utils/toTxHistoryEntry'
import { History } from './History'

function ready(items: readonly TransactionHistoryItem[]): HistoryFeed {
  return {
    status: 'ready',
    entries: items.flatMap((item) => toTxHistoryEntry(item) ?? []),
    hasMore: false,
    loadingMore: false,
    loadMore: () => {},
  }
}

function apiError(status: number) {
  return new DataApiError({
    status,
    body: null,
    url: 'https://data.example/v1/transactions',
  })
}

function ScenarioHistory(options: ScenarioFeedOptions) {
  return <History feed={useScenarioFeed(options)} onSelectEntry={fn()} />
}

const pages = longHistoryPages(Date.now())

const meta = {
  title: 'History/History',
  component: History,
  parameters: { layout: 'centered' },
  globals: { screen: 'off' },
  args: { feed: { status: 'loading' }, onSelectEntry: fn() },
  decorators: [withRealScreen('History')],
} satisfies Meta<typeof History>

export default meta
type Story = StoryObj<typeof meta>

export const Loading: Story = {}

export const Empty: Story = { args: { feed: ready([]) } }

export const AllOperations: Story = {
  args: { feed: ready(SCENARIOS.allOperations) },
}

export const Nfts: Story = { args: { feed: ready(SCENARIOS.nfts) } }

export const Approvals: Story = { args: { feed: ready(SCENARIOS.approvals) } }

export const Statuses: Story = { args: { feed: ready(SCENARIOS.statuses) } }

export const Unparsed: Story = { args: { feed: ready(SCENARIOS.unparsed) } }

export const TokenGaps: Story = { args: { feed: ready(SCENARIOS.tokenGaps) } }

export const Fees: Story = { args: { feed: ready(SCENARIOS.fees) } }

export const Chains: Story = { args: { feed: ready(SCENARIOS.chains) } }

export const Testnet: Story = { args: { feed: ready(SCENARIOS.testnet) } }

export const Formatting: Story = {
  args: { feed: ready(SCENARIOS.formatting) },
}

function errorStory(status: number): Story {
  return {
    render: () => (
      <ScenarioHistory
        pages={[SCENARIOS.allOperations]}
        failWith={apiError(status)}
      />
    ),
  }
}

export const Error429: Story = {
  ...errorStory(429),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await expect(
      await canvas.findByText('Sent USDC', undefined, { timeout: 3000 }),
    ).toBeInTheDocument()
  },
}

export const Error502: Story = errorStory(502)

export const Error401: Story = errorStory(401)

export const LongHistory: Story = {
  render: () => <ScenarioHistory pages={pages} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Load more' }))
    await canvas.findByRole('button', { name: 'Load more' }, { timeout: 3000 })
    const rows = canvas
      .getAllByRole('button')
      .filter((button) => button.textContent !== 'Load more')
    await expect(rows).toHaveLength(50)
  },
}

export const LoadMoreError: Story = {
  render: () => <ScenarioHistory pages={pages} failOnNext={apiError(429)} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Load more' }))
    await expect(
      await canvas.findByRole('alert', undefined, { timeout: 3000 }),
    ).toHaveTextContent('Too many requests. Try again in a moment.')
  },
}
