/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import {
  inheritedThemeAttributes,
  isThemeAvailable,
  resolveTheme,
  themeAttributes,
  themeStyle,
  themes,
} from './theme'

describe('resolveTheme', () => {
  it('reads a preset name as brand then mode', () => {
    expect(resolveTheme('plain-dark')).toEqual({
      mode: 'dark',
      brand: 'plain',
      tokens: {},
    })
  })

  it('defaults an object to branded light', () => {
    expect(resolveTheme({})).toEqual({
      mode: 'light',
      brand: 'branded',
      tokens: {},
    })
    expect(resolveTheme({ mode: 'system' }).mode).toBe('system')
  })

  it('keeps token overrides', () => {
    const theme = resolveTheme({
      ...themes.plainLight,
      tokens: { 'bg-neutral-primary': '#0b1020' },
    })
    expect(theme.brand).toBe('plain')
    expect(theme.tokens).toEqual({ 'bg-neutral-primary': '#0b1020' })
  })
})

describe('themeAttributes and themeStyle', () => {
  it('names the attributes the stylesheet keys on', () => {
    expect(themeAttributes(resolveTheme('plain-light'))).toEqual({
      'data-zd-mode': 'light',
      'data-zd-brand': 'plain',
    })
  })

  it('writes token overrides as custom properties', () => {
    expect(
      themeStyle(
        resolveTheme({
          tokens: {
            'text-brand-primary': '#7c5cff',
            'bg-neutral-primary': undefined,
          },
        }),
      ),
    ).toEqual({ '--zd-text-brand-primary': '#7c5cff' })
  })
})

describe('inheritedThemeAttributes', () => {
  it("reads the nearest themed ancestor's attributes, the element's own first, and nothing when none is themed", () => {
    const host = document.createElement('div')
    host.setAttribute('data-zd-mode', 'system')
    host.setAttribute('data-zd-brand', 'plain')
    const frame = document.createElement('div')
    host.appendChild(frame)

    expect(inheritedThemeAttributes(frame)).toEqual({
      'data-zd-mode': 'system',
      'data-zd-brand': 'plain',
    })

    frame.setAttribute('data-zd-mode', 'dark')
    frame.setAttribute('data-zd-brand', 'branded')
    expect(inheritedThemeAttributes(frame)).toEqual({
      'data-zd-mode': 'dark',
      'data-zd-brand': 'branded',
    })

    expect(inheritedThemeAttributes(document.createElement('div'))).toEqual({})
  })
})

describe('isThemeAvailable', () => {
  it('is true for the light variants the stylesheet carries', () => {
    expect(isThemeAvailable(resolveTheme('branded-light'))).toBe(true)
    expect(isThemeAvailable(resolveTheme('plain-light'))).toBe(true)
    expect(
      isThemeAvailable(resolveTheme({ mode: 'system', brand: 'plain' })),
    ).toBe(true)
  })

  it('is false while the stylesheet carries no dark variant', () => {
    expect(isThemeAvailable(resolveTheme('plain-dark'))).toBe(false)
  })
})
