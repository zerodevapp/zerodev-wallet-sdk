import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { version } from './version.js'

describe('version', () => {
  it('matches package.json, which the X-SDK-Version header reports', () => {
    // Tests run from the repo root.
    const pkg = JSON.parse(readFileSync('packages/react/package.json', 'utf8'))
    expect(version).toBe(pkg.version)
  })
})
