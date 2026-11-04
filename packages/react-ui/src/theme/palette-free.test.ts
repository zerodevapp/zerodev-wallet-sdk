/**
 * @vitest-environment node
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Components colour themselves through the semantic tokens, never the
 * palette: a palette class paints the same in every theme. This scans every
 * component source for a palette colour utility and fails on any that is
 * not listed below.
 */
const COMPONENTS = fileURLToPath(new URL('../components/', import.meta.url))

const PALETTE_CLASS =
  /zd:(?:[a-z-]+(?:\[[^\]]*\])?:)*(?:bg|text|border(?:-[trblxy])?|fill|stroke|ring|outline|caret|placeholder|from|to|via|divide)-(?:white|black|orange|solarOrange|paleOrange|lightOrange|skyBlue|greyBrown|warmGrey|offWhite|greyScale|positive|negative|gray-\d+|red-\d+|neutral-\d+|blue-\d+|green-\d+)(?:\/\d+)?/g

/** `<component>:<class>` pairs kept on the palette on purpose: overlays that
 * read the same on every theme (hover and press tints, the sheet scrim). */
const ALLOWED = new Set([
  'Button:zd:hover:bg-white/5',
  'Button:zd:active:bg-white/10',
  'Button:zd:hover:bg-white/20',
  'Button:zd:active:bg-white/30',
  'IconButton:zd:hover:bg-white/20',
  'IconButton:zd:active:bg-white/30',
  'ListItem:zd:hover:bg-white/20',
  'ListItem:zd:active:bg-white/30',
  'BottomSheet:zd:bg-greyScale/20',
])

function componentSources(): { component: string; file: string }[] {
  const out: { component: string; file: string }[] = []
  for (const dir of readdirSync(COMPONENTS, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue
    for (const file of readdirSync(join(COMPONENTS, dir.name))) {
      if (!file.endsWith('.tsx')) continue
      if (file.includes('.test.') || file.includes('.stories.')) continue
      out.push({ component: dir.name, file: join(COMPONENTS, dir.name, file) })
    }
  }
  return out
}

describe('component sources', () => {
  it('colour themselves through the semantic tokens, not the palette', () => {
    const offenders: string[] = []
    for (const { component, file } of componentSources()) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.match(PALETTE_CLASS) ?? []) {
        const key = `${component}:${match}`
        if (!ALLOWED.has(key)) offenders.push(key)
      }
    }
    expect(offenders).toEqual([])
  })

  it('keeps the allow list to classes that still exist', () => {
    const present = new Set<string>()
    for (const { component, file } of componentSources()) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.match(PALETTE_CLASS) ?? []) {
        present.add(`${component}:${match}`)
      }
    }
    for (const key of ALLOWED) expect(present).toContain(key)
  })
})
