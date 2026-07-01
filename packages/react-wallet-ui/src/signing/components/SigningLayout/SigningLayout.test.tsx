import { cleanup, render, screen } from '@testing-library/react'
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

vi.mock('../../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ config: null }),
}))

import { SigningLayout } from './index'

afterEach(() => {
  cleanup()
})

function getButton(label: string): HTMLButtonElement {
  return screen.getByText(label).closest('button') as HTMLButtonElement
}

describe('SigningLayout', () => {
  describe('default state', () => {
    it('renders children and enables Confirm', () => {
      render(
        <SigningLayout onConfirm={vi.fn()} onReject={vi.fn()}>
          <div data-testid="page-body">page content</div>
        </SigningLayout>,
      )

      expect(screen.getByTestId('page-body')).toBeDefined()
      expect(getButton('Confirm').disabled).toBe(false)
      expect(getButton('Reject').disabled).toBe(false)
    })
  })

  describe('disabled prop', () => {
    it('disables Confirm while Reject stays enabled', () => {
      render(
        <SigningLayout disabled onConfirm={vi.fn()} onReject={vi.fn()}>
          <div>body</div>
        </SigningLayout>,
      )

      expect(getButton('Confirm').disabled).toBe(true)
      expect(getButton('Reject').disabled).toBe(false)
    })
  })

  describe('error prop', () => {
    it('renders a Callout with the error message and disables Confirm', () => {
      const error = new Error('boom')
      render(
        <SigningLayout error={error} onConfirm={vi.fn()} onReject={vi.fn()}>
          <div>body</div>
        </SigningLayout>,
      )

      expect(screen.getByText('Unable to process transaction')).toBeDefined()
      expect(screen.getByText('boom')).toBeDefined()
      expect(getButton('Confirm').disabled).toBe(true)
      expect(getButton('Reject').disabled).toBe(false)
    })

    it('maps insufficient funds errors to a friendly title', () => {
      const error = new Error('insufficient funds for gas')
      render(
        <SigningLayout error={error} onConfirm={vi.fn()} onReject={vi.fn()}>
          <div>body</div>
        </SigningLayout>,
      )

      expect(screen.getByText('Insufficient funds')).toBeDefined()
    })
  })
})
