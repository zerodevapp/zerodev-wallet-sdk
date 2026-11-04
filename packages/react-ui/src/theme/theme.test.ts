/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import {
  applyThemeToElement,
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

describe('isThemeAvailable', () => {
  it('is true for the light variants the table states in full', () => {
    expect(isThemeAvailable(resolveTheme('branded-light'))).toBe(true)
    expect(isThemeAvailable(resolveTheme('plain-light'))).toBe(true)
    expect(
      isThemeAvailable(resolveTheme({ mode: 'system', brand: 'plain' })),
    ).toBe(true)
  })

  it('is false while a dark variant has unstated cells', () => {
    expect(isThemeAvailable(resolveTheme('plain-dark'))).toBe(false)
  })
})

describe('applyThemeToElement', () => {
  it('writes the attributes and overrides, and the undo removes them', () => {
    const element = document.createElement('div')
    const undo = applyThemeToElement(
      element,
      resolveTheme({
        ...themes.plainLight,
        tokens: { 'bg-neutral-primary': '#123456' },
      }),
    )
    expect(element.getAttribute('data-zd-mode')).toBe('light')
    expect(element.getAttribute('data-zd-brand')).toBe('plain')
    expect(element.style.getPropertyValue('--zd-bg-neutral-primary')).toBe(
      '#123456',
    )
    undo()
    expect(element.hasAttribute('data-zd-mode')).toBe(false)
    expect(element.hasAttribute('data-zd-brand')).toBe(false)
    expect(element.style.getPropertyValue('--zd-bg-neutral-primary')).toBe('')
  })
})
