/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The real Icon component uses `import.meta.glob` to eagerly load SVGs from
// disk, which vitest can't resolve. Stub it with a minimal mock that emits
// `data-testid="icon-<name>"` for query-by-testid.
vi.mock('../Icon', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../Icon')>()
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

import { ProgressStep } from './index'

afterEach(cleanup)

describe('ProgressStep', () => {
  it('renders the label', () => {
    render(<ProgressStep label="Deposit detected" status="done" />)
    expect(screen.getByText('Deposit detected')).toBeDefined()
  })

  describe('status marker', () => {
    it('done renders the done marker', () => {
      render(<ProgressStep label="Step" status="done" />)
      expect(screen.getByTestId('icon-done')).toBeDefined()
    })

    it('active renders the spinner', () => {
      render(<ProgressStep label="Step" status="active" />)
      // The spinner Icon carries its own data-testid, which wins over the
      // mock's `icon-<name>` id because props spread after it.
      expect(screen.getByTestId('progress-step-spinner')).toBeDefined()
    })

    it('failed renders the warning marker and negative label', () => {
      render(<ProgressStep label="Step" status="failed" />)
      expect(screen.getByTestId('icon-warning')).toBeDefined()
      expect(screen.getByText('Step').className).toContain('zd:text-negative')
    })

    it('pending renders no icon marker', () => {
      render(<ProgressStep label="Step" status="pending" />)
      expect(screen.queryByTestId('icon-done')).toBeNull()
      expect(screen.queryByTestId('progress-step-spinner')).toBeNull()
      expect(screen.queryByTestId('icon-warning')).toBeNull()
    })
  })

  describe('label tone', () => {
    it('mutes the label until done', () => {
      render(<ProgressStep label="Completed" status="pending" />)
      expect(screen.getByText('Completed').className).toContain(
        'zd:text-greyScale/50',
      )
    })

    it('renders the label at full intensity when done', () => {
      render(<ProgressStep label="Completed" status="done" />)
      const className = screen.getByText('Completed').className
      expect(className).toContain('zd:text-greyScale')
      expect(className).not.toContain('zd:text-greyScale/50')
    })
  })

  describe('slots', () => {
    it('renders trailing content', () => {
      render(
        <ProgressStep
          label="Step"
          status="done"
          right={<span data-testid="trailing">0x4d2a…ba99</span>}
        />,
      )
      expect(screen.getByTestId('trailing')).toBeDefined()
    })

    it('renders an info tooltip trigger when info is set', () => {
      render(<ProgressStep label="Step" status="done" info="Explanation" />)
      expect(screen.getByLabelText('More info')).toBeDefined()
    })

    it('renders no info trigger without info', () => {
      render(<ProgressStep label="Step" status="done" />)
      expect(screen.queryByLabelText('More info')).toBeNull()
    })
  })

  describe('connector line', () => {
    it('renders a connector by default and none when isLast', () => {
      const { container: withConnector } = render(
        <ProgressStep label="Step" status="done" />,
      )
      const { container: last } = render(
        <ProgressStep label="Step" status="done" isLast />,
      )
      expect(withConnector.querySelectorAll('div').length).toBeGreaterThan(
        last.querySelectorAll('div').length,
      )
    })
  })
})
