/**
 * @vitest-environment node
 *
 * Node, not happy-dom: the generated file is read off `import.meta.url`,
 * which a DOM environment turns into an http URL.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  renderTokensCss,
  renderVariantDeclarations,
} from '../../scripts/gen-tokens.mjs'
import {
  DEFAULT_THEME_VARIANT,
  THEME_VARIANTS,
  type ThemeTokenName,
  TOKEN_ROLES,
  themeTokenRole,
  themeTokens,
  themeTokenVar,
} from './tokens'

const names = Object.keys(themeTokens) as ThemeTokenName[]
const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/

describe('theme token table', () => {
  it('names every token by role, group and variant', () => {
    for (const name of names) {
      expect(name).toMatch(/^(bg|text|icon|border)-[a-z]+(-[a-z]+)+$/)
      expect(TOKEN_ROLES[themeTokenRole(name)]).toBeDefined()
    }
  })

  it('states a lowercase hex value, with or without alpha, for every known cell', () => {
    for (const name of names) {
      const values = themeTokens[name]
      expect(values).toHaveLength(THEME_VARIANTS.length)
      for (const value of values) {
        if (value !== null) expect(value).toMatch(HEX)
      }
    }
  })

  it('defines the default variant for every token', () => {
    const column = THEME_VARIANTS.indexOf(DEFAULT_THEME_VARIANT)
    for (const name of names) expect(themeTokens[name][column]).not.toBeNull()
  })

  it('maps a token to its custom property', () => {
    expect(themeTokenVar('bg-neutral-primary')).toBe('--zd-bg-neutral-primary')
  })
})

describe('generated tokens.css', () => {
  it('matches the table (run `pnpm gen:tokens` when this fails)', () => {
    const committed = readFileSync(
      new URL('./tokens.css', import.meta.url),
      'utf8',
    )
    expect(committed).toBe(renderTokensCss())
  })

  it('emits one property and one utility per token', () => {
    const css = renderTokensCss()
    for (const name of names) {
      expect(css).toContain(`  --zd-${name}: `)
      expect(css).toContain(`@utility ${name} {`)
    }
  })

  it('refuses a token whose utility would shadow a palette colour', () => {
    // `zd:bg-<palette>` already exists for every palette colour.
    expect(() =>
      renderTokensCss({
        'bg-offWhite': ['#ffffff', '#ffffff', '#ffffff', '#ffffff'],
      }),
    ).toThrow(/shadows the palette colour offWhite/)
  })

  it('refuses a variant with an unstated cell', () => {
    expect(() =>
      renderVariantDeclarations({ mode: 'dark', brand: 'plain' }),
    ).toThrow(/no value for dark\/plain/)
  })
})
