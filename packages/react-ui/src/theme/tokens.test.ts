/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const THEME_BRANDS = ['branded', 'plain'] as const
/** The variants the stylesheet carries values for: every cell of the grid. */
const SHIPPED_THEME_VARIANTS = [
  { mode: 'light', brand: 'branded' },
  { mode: 'light', brand: 'plain' },
  { mode: 'dark', brand: 'branded' },
  { mode: 'dark', brand: 'plain' },
] as const

/** The selector a dark block (or its `system` twin) is keyed on: the plain
 * brand names itself, the branded one is the default and keys on the mode
 * alone, so a host that writes only `data-zd-mode` gets it. */
function darkSelector(mode: 'dark' | 'system', brand: 'branded' | 'plain') {
  return brand === 'plain'
    ? `:where([data-zd-mode="${mode}"][data-zd-brand="plain"])`
    : `:where([data-zd-mode="${mode}"]:not([data-zd-brand="plain"]))`
}

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')
/** Tailwind namespace per role, as the @theme inline aliases use them. */
const NAMESPACE: Record<string, string> = {
  bg: 'background-color',
  text: 'text-color',
  icon: 'text-color-icon',
  border: 'border-color',
}
/** The utility prefix per role, as the @source inline line spells it. */
const UTILITY: Record<string, string> = {
  bg: 'bg',
  text: 'text',
  icon: 'text-icon',
  border: 'border',
}
const HEX = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/

/** A top-level block's body by a prefix of its selector text; `nested` for
 * a block inside the media query, which closes on an indented brace. */
function block(selectorStart: string, nested = false): string {
  const start = css.indexOf(selectorStart)
  expect(start, `block ${selectorStart}`).toBeGreaterThanOrEqual(0)
  const open = css.indexOf('{', start)
  return css.slice(open + 1, css.indexOf(nested ? '\n  }' : '\n}', open))
}

/** `--zd-<token>: <value>` pairs declared in a block body. */
/** The token declarations of a block. `--zd-color-scheme` carries the mode's
 * colour scheme to the kit's surfaces and is not a token, so it is left out. */
function declarations(body: string): Map<string, string> {
  return new Map(
    [...body.matchAll(/^\s+--zd-([a-z-]+): (.+);$/gm)]
      .filter(([, n]) => n !== 'color-scheme')
      .map(([, n, v]) => [n, v]),
  )
}

/** Every candidate a `@source inline("...")` pattern expands to. */
function expand(pattern: string): string[] {
  const group = pattern.match(/\{([^{}]*)\}/)
  if (!group) return [pattern]
  return group[1]
    .split(',')
    .flatMap((word) => expand(pattern.replace(group[0], word)))
}

/** Token name -> alias namespace, from the @theme inline block. */
const aliases = new Map(
  [
    ...block('@theme inline').matchAll(
      /^\s+--([a-z-]+?)-([a-z-]+): var\(--zd-([a-z-]+)\);$/gm,
    ),
  ].map(([, namespace, tail, name]) => [name, { namespace, tail }]),
)
const names = [...aliases.keys()]
const role = (name: string) => name.slice(0, name.indexOf('-'))
const branded = declarations(block(':where(:root)'))
const plain = declarations(block(':where([data-zd-brand="plain"])'))
const plainDark = declarations(block(darkSelector('dark', 'plain')))
const brandedDark = declarations(block(darkSelector('dark', 'branded')))

describe('theme/tokens.css', () => {
  it('aliases each token under the namespace of its role', () => {
    expect(names.length).toBeGreaterThan(0)
    for (const [name, { namespace, tail }] of aliases) {
      expect(`${namespace}-${tail}`).toBe(
        `${NAMESPACE[role(name)]}-${name.slice(role(name).length + 1)}`,
      )
    }
  })

  it('states a lowercase hex value for every token in every shipped variant', () => {
    const blocks = { branded, plain, brandedDark, plainDark }
    for (const [name, values] of Object.entries(blocks)) {
      expect([...values.keys()].sort(), name).toEqual([...names].sort())
      for (const value of values.values()) expect(value).toMatch(HEX)
    }
  })

  it('carries a block per shipped variant with its colour scheme, and `system` follows the dark one under a dark scheme', () => {
    for (const brand of THEME_BRANDS)
      expect(css).toContain(`:where([data-zd-brand="${brand}"])`)
    expect(block(':where([data-zd-mode="light"])')).toContain(
      '--zd-color-scheme: light;',
    )
    // The scheme itself lands on the kit's surfaces, not on the host page.
    expect(block(':where(.zd-scope)')).toContain(
      'color-scheme: var(--zd-color-scheme, light);',
    )
    // The last one: the `zd:dark:` variant carries a media rule of its own.
    const media = css.lastIndexOf('@media (prefers-color-scheme: dark)')
    for (const { mode, brand } of SHIPPED_THEME_VARIANTS) {
      if (mode === 'light') continue
      const dark = block(darkSelector('dark', brand))
      expect(dark).toContain('--zd-color-scheme: dark;')
      expect(css.indexOf(darkSelector('dark', brand))).toBeLessThan(media)
      expect(css.indexOf(darkSelector('system', brand))).toBeGreaterThan(media)
      const system = block(darkSelector('system', brand), true)
      expect(system).toContain('--zd-color-scheme: dark;')
      expect(declarations(system.replace(/^ {2}/gm, ''))).toEqual(
        declarations(dark),
      )
    }
  })

  it('safelists every token utility, so the compiled stylesheet ships them all', () => {
    const safelisted = new Set(
      [...css.matchAll(/@source inline\("([^"]+)"\)/g)].flatMap(([, p]) =>
        expand(p),
      ),
    )
    for (const name of names) {
      const utility = `zd:${UTILITY[role(name)]}-${name.slice(role(name).length + 1)}`
      expect(
        safelisted.has(utility),
        `${utility} is not safelisted: add the new word to the @source inline line`,
      ).toBe(true)
    }
  })
})
