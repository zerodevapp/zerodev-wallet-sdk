#!/usr/bin/env node
// Repoints apps/qa-lab-testing at one commit's pkg.pr.new previews, so CI installs
// the SDK from real tarballs and `files` and `exports` are actually enforced. A
// `workspace:*` install symlinks the source tree and checks neither.
//
//   node scripts/use-preview-packages.mjs <head-sha>
//
// A sha, not a PR number: `@<pr>` is a moving tag, so CI could install one commit
// while reporting on another. ci.yml passes the Preview workflow's own output and
// depends on it, which is why nothing here checks that the URLs resolve.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = join(root, 'apps/qa-lab-testing/package.json')

const sha = process.argv[2]
if (!/^[0-9a-f]{7,40}$/i.test(sha ?? '')) {
  console.error('usage: node scripts/use-preview-packages.mjs <head-sha>')
  process.exit(1)
}

const previewUrl = (name) => `https://pkg.pr.new/${name}@${sha}`

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const deps = manifest.dependencies ?? {}
// Only @zerodev deps are relevant to this script, so ignore the rest.
const sdkDeps = Object.keys(deps).filter((name) => name.startsWith('@zerodev/'))

if (!sdkDeps.length) {
  console.error('use-preview-packages: the QA lab declares no @zerodev dependencies.')
  console.error('Nothing would be installed from a preview, so this job would prove nothing.')
  process.exit(1)
}

const toRewrite = sdkDeps.filter((name) => deps[name].startsWith('workspace:'))
const alreadyPinned = sdkDeps.filter((name) => deps[name] === previewUrl(name))
// `.npmrc` sets link-workspace-packages=deep, so a plain semver range silently
// resolves back to the local package. Refuse rather than test a symlink.
const unexpected = sdkDeps.filter(
  (name) => !toRewrite.includes(name) && !alreadyPinned.includes(name),
)

if (unexpected.length) {
  console.error(`use-preview-packages: unexpected @zerodev specifiers for ${sha}:\n`)
  for (const name of unexpected) console.error(`  ✗ ${name}: ${deps[name]}`)
  console.error('\nEach must be `workspace:*` (to rewrite) or the preview URL for this commit.')
  if (unexpected.some((name) => !deps[name].startsWith('https://pkg.pr.new/'))) {
    console.error('A plain version range resolves to the workspace package via')
    console.error('`link-workspace-packages=deep`, which is the symlink this job exists to avoid.')
  }
  process.exit(1)
}

if (!toRewrite.length) {
  console.log(`use-preview-packages: all ${sdkDeps.length} @zerodev deps already pinned to ${sha}`)
  process.exit(0)
}

for (const name of toRewrite) deps[name] = previewUrl(name)
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`use-preview-packages: QA lab now installs ${sha} previews`)
for (const name of toRewrite) console.log(`  ✓ ${name} -> ${previewUrl(name)}`)
