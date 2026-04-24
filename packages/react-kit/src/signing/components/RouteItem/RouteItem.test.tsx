import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../shared/components/Icon', async () => {
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

import { RouteItem } from './index'

afterEach(() => {
  cleanup()
})

describe('RouteItem', () => {
  it('renders the source and destination network names title-cased', () => {
    render(
      <RouteItem source="ethereum" destination="arbitrum" gasFee="$0.12" />,
    )
    expect(screen.getByText('Ethereum')).toBeDefined()
    expect(screen.getByText('Arbitrum')).toBeDefined()
  })

  it('renders the source icon', () => {
    render(
      <RouteItem source="ethereum" destination="arbitrum" gasFee="$0.12" />,
    )
    expect(screen.getByTestId('icon-ethereum')).toBeDefined()
  })

  it('renders the destination icon', () => {
    render(
      <RouteItem source="ethereum" destination="arbitrum" gasFee="$0.12" />,
    )
    expect(screen.getByTestId('icon-arbitrum')).toBeDefined()
  })

  it('renders the arrow between source and destination labels', () => {
    render(
      <RouteItem source="ethereum" destination="arbitrum" gasFee="$0.12" />,
    )
    expect(screen.getByTestId('icon-arrowRightFill')).toBeDefined()
  })

  it('renders the gas fee and gas-station icon', () => {
    render(
      <RouteItem source="ethereum" destination="arbitrum" gasFee="$0.12" />,
    )
    expect(screen.getByText('$0.12')).toBeDefined()
    expect(screen.getByTestId('icon-gasStation')).toBeDefined()
  })
})
