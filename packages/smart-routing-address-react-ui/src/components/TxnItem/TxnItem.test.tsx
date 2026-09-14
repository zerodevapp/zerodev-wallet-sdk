/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TxnItem, type TxnStatus } from './index'

afterEach(cleanup)

const BASE = {
  amount: '$248.00 USD',
  address: '0x4d2a…ba99',
  timestamp: '2 mo ago',
} as const

describe('TxnItem', () => {
  it('renders amount, address, and timestamp', () => {
    render(<TxnItem {...BASE} status="Delivered" />)
    expect(screen.getByText('$248.00 USD')).toBeDefined()
    expect(screen.getByText('0x4d2a…ba99')).toBeDefined()
    expect(screen.getByText('2 mo ago')).toBeDefined()
  })

  it('renders the status label', () => {
    render(<TxnItem {...BASE} status="Routing" />)
    expect(screen.getByText('Routing')).toBeDefined()
  })

  it.each<TxnStatus>(['Routing', 'Detected', 'Delivered', 'Failed'])(
    'accepts %s status without crashing',
    (status) => {
      render(<TxnItem {...BASE} status={status} />)
      expect(screen.getByText(status)).toBeDefined()
    },
  )

  it('shows the spinner marker only while Routing', () => {
    const { container, unmount } = render(
      <TxnItem {...BASE} status="Routing" />,
    )
    expect(container.querySelector('.zd\\:animate-spin')).not.toBeNull()
    unmount()
    const { container: done } = render(<TxnItem {...BASE} status="Delivered" />)
    expect(done.querySelector('.zd\\:animate-spin')).toBeNull()
  })

  it('renders Delivered in green', () => {
    render(<TxnItem {...BASE} status="Delivered" />)
    expect(screen.getByText('Delivered').className).toContain('positive')
  })

  it('renders the address as a link when href is provided', () => {
    render(
      <TxnItem
        {...BASE}
        status="Delivered"
        href="https://arbiscan.io/tx/0xabc"
      />,
    )
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('https://arbiscan.io/tx/0xabc')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer noopener')
  })

  it('renders the address as plain text (no link) when href is omitted', () => {
    render(<TxnItem {...BASE} status="Delivered" />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('compact rows show the token with the source-chain badge only', () => {
    const { container } = render(
      <TxnItem
        {...BASE}
        status="Delivered"
        sourceTokenIconUrl="data:image/svg+xml;base64,c3JjLXRvaw=="
        sourceChainIconUrl="data:image/svg+xml;base64,c3JjLWNoIQ=="
        destTokenIconUrl="data:image/svg+xml;base64,ZHN0LXRvaw=="
        destChainIconUrl="data:image/svg+xml;base64,ZHN0LWNoIQ=="
      />,
    )
    // Decorative `<img alt="">` gets role="presentation" — query DOM directly.
    const srcs = Array.from(container.querySelectorAll('img')).map(
      (img) => img.getAttribute('src') ?? '',
    )
    expect(srcs).toContain('data:image/svg+xml;base64,c3JjLXRvaw==')
    expect(srcs).toContain('data:image/svg+xml;base64,c3JjLWNoIQ==')
    // Dest icons only appear on the detailed variant
    expect(srcs).not.toContain('data:image/svg+xml;base64,ZHN0LXRvaw==')
    expect(srcs).not.toContain('data:image/svg+xml;base64,ZHN0LWNoIQ==')
  })

  it('detailed rows show both amounts, the chain route, and the dest badge', () => {
    const { container } = render(
      <TxnItem
        {...BASE}
        destAmount="$247.10 USD"
        status="Delivered"
        sourceTokenIconUrl="data:image/svg+xml;base64,c3JjLXRvaw=="
        sourceChainIconUrl="data:image/svg+xml;base64,c3JjLWNoIQ=="
        destTokenIconUrl="data:image/svg+xml;base64,ZHN0LXRvaw=="
        destChainIconUrl="data:image/svg+xml;base64,ZHN0LWNoIQ=="
        sourceChainName="Arbitrum"
        destChainName="Robinhood"
      />,
    )
    expect(screen.getByText('$248.00 USD')).toBeDefined()
    expect(screen.getByText('$247.10 USD')).toBeDefined()
    expect(screen.getByText('Arbitrum')).toBeDefined()
    expect(screen.getByText('Robinhood')).toBeDefined()
    const srcs = Array.from(container.querySelectorAll('img')).map(
      (img) => img.getAttribute('src') ?? '',
    )
    // Mark badge = dest token; route line carries both chain icons
    expect(srcs).toContain('data:image/svg+xml;base64,ZHN0LXRvaw==')
    expect(srcs).toContain('data:image/svg+xml;base64,c3JjLWNoIQ==')
    expect(srcs).toContain('data:image/svg+xml;base64,ZHN0LWNoIQ==')
  })

  it('omits the chain-route line on compact rows even with chain names absent', () => {
    render(<TxnItem {...BASE} status="Routing" />)
    expect(screen.queryByText('Arbitrum')).toBeNull()
  })
})
