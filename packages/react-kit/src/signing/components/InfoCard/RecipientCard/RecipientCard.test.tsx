import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../shared/components/Icon', async () => {
  const React = await import('react')

  const MockIcon = ({
    name,
    ...props
  }: { name: string } & React.SVGProps<SVGSVGElement>) =>
    React.createElement('svg', { 'data-testid': `icon-${name}`, ...props })

  return {
    Icon: MockIcon,
    icons: {},
  }
})

import { RecipientCard } from './index'

function renderWithClient(ui: ReactNode, client: QueryClient) {
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678' as const

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('RecipientCard', () => {
  it('renders "Unknown recipient" and a Save button when address is not in contacts', async () => {
    const client = createClient()
    await act(async () => {
      renderWithClient(<RecipientCard address={ADDRESS} />, client)
    })
    expect(screen.getByText('Unknown recipient')).toBeDefined()
    expect(screen.getByText('Save')).toBeDefined()
  })

  it('renders the shortened address as subtitle', async () => {
    const client = createClient()
    await act(async () => {
      renderWithClient(<RecipientCard address={ADDRESS} />, client)
    })
    expect(screen.getByText('0x1234...5678')).toBeDefined()
  })

  it('renders a check icon (no Save button) when the address matches a saved contact', async () => {
    const client = createClient()
    client.setQueryData(['contacts'], [{ name: 'Alice', address: ADDRESS }])
    await act(async () => {
      renderWithClient(<RecipientCard address={ADDRESS} />, client)
    })
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.queryByText('Save')).toBeNull()
    expect(screen.getByTestId('icon-checks')).toBeDefined()
  })

  it('matches contacts case-insensitively', async () => {
    const client = createClient()
    client.setQueryData(
      ['contacts'],
      [{ name: 'Alice', address: ADDRESS.toUpperCase() }],
    )
    await act(async () => {
      renderWithClient(<RecipientCard address={ADDRESS} />, client)
    })
    expect(screen.getByText('Alice')).toBeDefined()
  })
})
