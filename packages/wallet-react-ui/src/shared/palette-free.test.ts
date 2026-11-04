/**
 * @vitest-environment node
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Screens and components colour themselves through react-ui's semantic
 * tokens, never the palette: a palette class paints the same in every
 * theme. This scans every source file for a palette colour utility.
 */
const SRC = fileURLToPath(new URL('../', import.meta.url))

const PALETTE_CLASS =
  /zd:(?:[a-z-]+(?:\[[^\]]*\])?:)*(?:bg|text|border(?:-[trblxy])?|fill|stroke|ring|outline|caret|placeholder|from|to|via|divide)-(?:white|black|orange|solarOrange|paleOrange|lightOrange|skyBlue|greyBrown|warmGrey|offWhite|greyScale|positive|negative|gray-\d+|red-\d+|neutral-\d+|blue-\d+|green-\d+)(?:\/\d+)?/g

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const file = join(dir, name)
    if (statSync(file).isDirectory()) sources(file, out)
    else if (
      file.endsWith('.tsx') &&
      !file.includes('.test.') &&
      !file.includes('.stories.')
    )
      out.push(file)
  }
  return out
}

describe('wallet-react-ui sources', () => {
  it('colour themselves through the semantic tokens, not the palette', () => {
    const offenders: string[] = []
    for (const file of sources(SRC)) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.match(PALETTE_CLASS) ?? []) {
        offenders.push(`${file.slice(SRC.length)}:${match}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
