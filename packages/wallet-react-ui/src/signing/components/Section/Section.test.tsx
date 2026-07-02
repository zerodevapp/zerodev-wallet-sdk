import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@zerodev/react-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@zerodev/react-ui')>()
  const React = await import('react')

  const MockIcon = ({
    name,
    ...props
  }: { name: string } & React.SVGProps<SVGSVGElement>) =>
    React.createElement('svg', { 'data-testid': `icon-${name}`, ...props })

  return {
    ...actual,
    Icon: MockIcon,
    icons: {},
  }
})

import { Section } from './index'

afterEach(() => {
  cleanup()
})

describe('Section', () => {
  describe('rendering', () => {
    it('renders title and leading icon', () => {
      render(
        <Section title="Details" iconName="wallet">
          <span>body</span>
        </Section>,
      )
      expect(screen.getByText('Details')).toBeDefined()
      expect(screen.getByTestId('icon-wallet')).toBeDefined()
    })

    it('renders children by default (not collapsible)', () => {
      render(
        <Section title="Details" iconName="wallet">
          <span>body</span>
        </Section>,
      )
      expect(screen.getByText('body')).toBeDefined()
    })

    it('does not render a toggle button when collapsible prop is omitted', () => {
      render(
        <Section title="Details" iconName="wallet">
          <span>body</span>
        </Section>,
      )
      expect(screen.queryByRole('button')).toBeNull()
    })
  })

  describe('collapsible=false (starts expanded)', () => {
    it('renders children initially and shows a chevronUp icon', () => {
      render(
        <Section title="Details" iconName="wallet" collapsible={false}>
          <span>body</span>
        </Section>,
      )
      expect(screen.getByText('body')).toBeDefined()
      expect(screen.getByTestId('icon-chevronUp')).toBeDefined()
    })

    it('hides children after clicking the toggle', () => {
      render(
        <Section title="Details" iconName="wallet" collapsible={false}>
          <span>body</span>
        </Section>,
      )
      fireEvent.click(screen.getByRole('button'))
      expect(screen.queryByText('body')).toBeNull()
      expect(screen.getByTestId('icon-chevronDown')).toBeDefined()
    })
  })

  describe('collapsible=true (starts collapsed)', () => {
    it('hides children initially and shows a chevronDown icon', () => {
      render(
        <Section title="Details" iconName="wallet" collapsible>
          <span>body</span>
        </Section>,
      )
      expect(screen.queryByText('body')).toBeNull()
      expect(screen.getByTestId('icon-chevronDown')).toBeDefined()
    })

    it('reveals children after clicking the toggle', () => {
      render(
        <Section title="Details" iconName="wallet" collapsible>
          <span>body</span>
        </Section>,
      )
      fireEvent.click(screen.getByRole('button'))
      expect(screen.getByText('body')).toBeDefined()
      expect(screen.getByTestId('icon-chevronUp')).toBeDefined()
    })
  })
})
