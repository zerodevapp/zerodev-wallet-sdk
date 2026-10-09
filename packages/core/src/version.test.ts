import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { version } from './version.js'

describe('version', () => {
  it('matches package.json, which the X-SDK-Version header reports', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8'),
    )
    expect(version).toBe(pkg.version)
  })
})
