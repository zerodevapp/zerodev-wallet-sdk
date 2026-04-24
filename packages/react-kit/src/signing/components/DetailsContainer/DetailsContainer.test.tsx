import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

import { DetailsContainer } from './index'

afterEach(() => {
  cleanup()
})

describe('DetailsContainer', () => {
  describe('rendering', () => {
    it('renders title and leading icon', () => {
      render(
        <DetailsContainer title="Details" iconName="wallet">
          <span>body</span>
        </DetailsContainer>,
      )
      expect(screen.getByText('Details')).toBeDefined()
      expect(screen.getByTestId('icon-wallet')).toBeDefined()
    })

    it('renders children by default (not collapsible)', () => {
      render(
        <DetailsContainer title="Details" iconName="wallet">
          <span>body</span>
        </DetailsContainer>,
      )
      expect(screen.getByText('body')).toBeDefined()
    })

    it('does not render a toggle button when collapsible prop is omitted', () => {
      render(
        <DetailsContainer title="Details" iconName="wallet">
          <span>body</span>
        </DetailsContainer>,
      )
      expect(screen.queryByRole('button')).toBeNull()
    })
  })

  describe('collapsible=false (starts expanded)', () => {
    it('renders children initially and shows a chevronUp icon', () => {
      render(
        <DetailsContainer title="Details" iconName="wallet" collapsible={false}>
          <span>body</span>
        </DetailsContainer>,
      )
      expect(screen.getByText('body')).toBeDefined()
      expect(screen.getByTestId('icon-chevronUp')).toBeDefined()
    })

    it('hides children after clicking the toggle', () => {
      render(
        <DetailsContainer title="Details" iconName="wallet" collapsible={false}>
          <span>body</span>
        </DetailsContainer>,
      )
      fireEvent.click(screen.getByRole('button'))
      expect(screen.queryByText('body')).toBeNull()
      expect(screen.getByTestId('icon-chevronDown')).toBeDefined()
    })
  })

  describe('collapsible=true (starts collapsed)', () => {
    it('hides children initially and shows a chevronDown icon', () => {
      render(
        <DetailsContainer title="Details" iconName="wallet" collapsible>
          <span>body</span>
        </DetailsContainer>,
      )
      expect(screen.queryByText('body')).toBeNull()
      expect(screen.getByTestId('icon-chevronDown')).toBeDefined()
    })

    it('reveals children after clicking the toggle', () => {
      render(
        <DetailsContainer title="Details" iconName="wallet" collapsible>
          <span>body</span>
        </DetailsContainer>,
      )
      fireEvent.click(screen.getByRole('button'))
      expect(screen.getByText('body')).toBeDefined()
      expect(screen.getByTestId('icon-chevronUp')).toBeDefined()
    })
  })
})
