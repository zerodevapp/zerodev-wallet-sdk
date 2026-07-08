#!/usr/bin/env node
// Guards npm Trusted Publishing (OIDC): every publishable package — any
// packages/* that isn't `"private": true` — must carry a `repository` field
// whose url matches this repo and whose `directory` matches its folder. npm's
// provenance check rejects a publish otherwise with E422 (this bit us once:
// wallet-react@0.0.2 failed to publish while a dependent already had).
//
// Runs on every PR (in the Lint job), so the failure is caught before the
// "Version Packages" PR is ever created — no post-merge rollback.
//
//   node scripts/check-publishable.mjs          # validate, exit 1 on problems
//   node scripts/check-publishable.mjs --list    # print publishable dirs, one per line
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkgsDir = join(root, 'packages')
const EXPECTED_URL = 'git+https://github.com/zerodevapp/zerodev-wallet-sdk.git'
const listOnly = process.argv.includes('--list')

const publishable = []
for (const name of readdirSync(pkgsDir).sort()) {
  const pkgPath = join(pkgsDir, name, 'package.json')
  if (!existsSync(pkgPath)) continue
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  if (pkg.private === true) continue // intentionally never published
  publishable.push({ name, pkg })
}

if (listOnly) {
  for (const { name } of publishable) console.log(`packages/${name}`)
  process.exit(0)
}

if (!publishable.length) {
  console.error('check-publishable: no publishable packages found — did the packages/ layout change?')
  process.exit(1)
}

const errors = []
for (const { name, pkg } of publishable) {
  const dir = `packages/${name}`
  const repo = pkg.repository
  if (!repo || typeof repo !== 'object') {
    errors.push(`${pkg.name}: missing "repository" object`)
    continue
  }
  if (!repo.url || !repo.url.trim()) {
    errors.push(`${pkg.name}: "repository.url" is empty`)
  } else if (repo.url !== EXPECTED_URL) {
    errors.push(`${pkg.name}: "repository.url" is "${repo.url}", expected "${EXPECTED_URL}"`)
  }
  if (repo.directory !== dir) {
    errors.push(`${pkg.name}: "repository.directory" is "${repo.directory ?? '(unset)'}", expected "${dir}"`)
  }
}

if (errors.length) {
  console.error('Publishable package checks failed:\n')
  for (const e of errors) console.error(`  ✗ ${e}`)
  console.error('\nnpm Trusted Publishing rejects a publish whose package.json "repository"')
  console.error('does not match the source repo (E422). Fix these before merging.')
  process.exit(1)
}

console.log(`check-publishable: OK — ${publishable.length} publishable packages have a valid repository field`)
for (const { pkg } of publishable) console.log(`  ✓ ${pkg.name}`)
