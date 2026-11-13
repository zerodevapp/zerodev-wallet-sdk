/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

/** Utility prefix for each @theme colour namespace. */
const UTILITY: Record<string, string> = {
  'background-color': 'bg',
  'text-color': 'text',
  'text-color-icon': 'text-icon',
  'border-color': 'border',
}

/** `zd:bg-neutral-primary`, … for every variable in the @theme block. */
const declared = [
  ...css.matchAll(
    /^\s+--(background-color|text-color-icon|text-color|border-color)-([a-z-]+): (#[0-9a-f]{6}(?:[0-9a-f]{2})?);$/gm,
  ),
].map(([, namespace, tail]) => `zd:${UTILITY[namespace]}-${tail}`)

/** Every class the `@source inline` lines name, brace groups expanded. */
function expand(pattern: string): string[] {
  const m = pattern.match(/^([^{]*)\{([^}]*)\}(.*)$/)
  if (!m) return [pattern]
  return m[2].split(',').flatMap((alt) => expand(`${m[1]}${alt}${m[3]}`))
}
const safelisted = new Set(
  [...css.matchAll(/^@source inline\("([^"]+)"\);$/gm)].flatMap(([, p]) =>
    expand(p),
  ),
)

describe('theme/tokens.css', () => {
  it('declares a lowercase hex value per token', () => {
    const vars = css.match(/^\s+--[a-z-]+:/gm) ?? []
    expect(declared.length).toBe(vars.length)
    expect(declared.length).toBeGreaterThan(0)
  })

  it('safelists every declared token, so the compiled stylesheet ships them all', () => {
    const missing = declared.filter((c) => !safelisted.has(c))
    expect(missing, 'add the new word to the @source inline line').toEqual([])
  })
})
