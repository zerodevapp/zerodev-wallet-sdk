/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { TokenSummary } from './index'

afterEach(cleanup)

describe('TokenSummary', () => {
  it('renders the fiat value and crypto amount', () => {
    render(<TokenSummary primaryValue="+$170.27" secondaryValue="0.0652 ETH" />)
    expect(screen.getByText('+$170.27')).toBeDefined()
    expect(screen.getByText('0.0652 ETH')).toBeDefined()
  })

  it('renders the token logo when a URL is supplied', () => {
    const { container } = render(
      <TokenSummary
        primaryValue="+$170.27"
        secondaryValue="0.0652 ETH"
        tokenLogoUrl="https://x/eth.png"
      />,
    )
    expect(
      container.querySelector('img[src="https://x/eth.png"]'),
    ).not.toBeNull()
  })

  it('renders an empty tile without a logo URL', () => {
    const { container } = render(
      <TokenSummary primaryValue="+$170.27" secondaryValue="0.0652 ETH" />,
    )
    expect(container.querySelector('img')).toBeNull()
  })
})

describe('TokenSummary badge and secondary line', () => {
  it('omits the secondary line when not provided', () => {
    render(<TokenSummary primaryValue="249.78 USDG" />)
    expect(screen.getByText('249.78 USDG')).toBeDefined()
  })

  it('renders the badge when a URL is supplied', () => {
    const { container } = render(
      <TokenSummary
        primaryValue="249.78 USDG"
        tokenLogoUrl="https://x/usdg.png"
        badgeLogoUrl="https://x/base.png"
      />,
    )
    expect(
      container.querySelector('img[src="https://x/base.png"]'),
    ).not.toBeNull()
  })
})
