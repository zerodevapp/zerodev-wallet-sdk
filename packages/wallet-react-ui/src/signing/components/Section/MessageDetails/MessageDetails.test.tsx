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

import { MessageDetails } from './index'

afterEach(() => {
  cleanup()
})

describe('MessageDetails', () => {
  it('renders the "Message Details" title and message icon', () => {
    render(<MessageDetails details={{ from: '0x1', to: '0x2' }} />)
    expect(screen.getByText('Message Details')).toBeDefined()
    expect(screen.getByTestId('icon-message')).toBeDefined()
  })

  it('renders a row per entry in the details object (labels title-cased)', () => {
    render(
      <MessageDetails
        details={{ from: '0xfrom', to: '0xto', gasFee: '0.001' }}
      />,
    )
    expect(screen.getByText('From')).toBeDefined()
    expect(screen.getByText('0xfrom')).toBeDefined()
    expect(screen.getByText('To')).toBeDefined()
    expect(screen.getByText('0xto')).toBeDefined()
    expect(screen.getByText('Gas Fee')).toBeDefined()
    expect(screen.getByText('0.001')).toBeDefined()
  })

  it('renders nothing below the header when details is empty', () => {
    render(<MessageDetails details={{}} />)
    expect(screen.getByText('Message Details')).toBeDefined()
  })
})
