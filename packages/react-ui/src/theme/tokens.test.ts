/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

const BRANDS = ['branded', 'plain']
const MODES = ['light']
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

/** A top-level block's body by a prefix of its selector text. */
function block(selectorStart: string): string {
  const start = css.indexOf(selectorStart)
  expect(start, `block ${selectorStart}`).toBeGreaterThanOrEqual(0)
  const open = css.indexOf('{', start)
  return css.slice(open + 1, css.indexOf('\n}', open))
}

/** `--zd-<token>: <value>` pairs declared in a block body. */
function declarations(body: string): Map<string, string> {
  return new Map(
    [...body.matchAll(/^\s+--zd-([a-z-]+): (.+);$/gm)].map(([, n, v]) => [
      n,
      v,
    ]),
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

describe('theme/tokens.css', () => {
  it('aliases each token under the namespace of its role', () => {
    expect(names.length).toBeGreaterThan(0)
    for (const [name, { namespace, tail }] of aliases) {
      expect(`${namespace}-${tail}`).toBe(
        `${NAMESPACE[role(name)]}-${name.slice(role(name).length + 1)}`,
      )
    }
  })

  it('states a lowercase hex value for every token in every brand', () => {
    for (const brand of BRANDS) {
      const values = brand === 'branded' ? branded : plain
      expect([...values.keys()].sort(), brand).toEqual([...names].sort())
      for (const value of values.values()) expect(value).toMatch(HEX)
    }
  })

  it('carries a block per brand and sets the scheme per mode', () => {
    for (const brand of BRANDS)
      expect(css).toContain(`:where([data-zd-brand="${brand}"])`)
    for (const mode of MODES)
      expect(block(`:where([data-zd-mode="${mode}"])`)).toContain(
        `color-scheme: ${mode};`,
      )
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
