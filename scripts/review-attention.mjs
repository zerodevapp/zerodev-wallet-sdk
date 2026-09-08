#!/usr/bin/env node
/**
 * Review attention map (playbook, Part 4 · File granularity).
 *
 * Classifies each changed file into a review tier and emits:
 *   1. workflow-command annotations anchored to the file's first changed
 *      line — GitHub renders those inline in the Files changed tab (an
 *      annotation on line 0 only shows in the Checks tab, which is why the
 *      anchor matters);
 *   2. a markdown attention map on stdout for the sticky PR comment.
 *
 *   node scripts/review-attention.mjs <base-sha> [--markdown]
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const [baseSha, ...flags] = process.argv.slice(2)
if (!baseSha) {
  console.error('usage: review-attention.mjs <base-sha> [--markdown]')
  process.exit(2)
}
const MARKDOWN = flags.includes('--markdown')

const git = (args) => execFileSync('git', args, { encoding: 'utf8' })

const LABELER = path.join(import.meta.dirname, '..', '.github', 'labeler.yml')

/**
 * The review:human globs, read from .github/labeler.yml so the label and this
 * map can't disagree — they did once, and the file it happened on
 * (`connector.ts`) was the root cause of the PR under review.
 *
 * Deliberately a small extractor rather than a YAML dependency: the file's
 * shape is fixed (one `review:human:` block of quoted globs), and a parse
 * failure would silently downgrade every risky file, so failing loudly on an
 * empty result is part of the contract.
 */
function humanGlobs() {
  const text = fs.readFileSync(LABELER, 'utf8')
  const block = text.split(/^review:human:/m)[1]?.split(/^\S/m)[0]
  const globs = [...(block ?? '').matchAll(/^\s*-\s*"([^"]+)"/gm)].map((m) => m[1])
  if (globs.length === 0) {
    throw new Error(`no review:human globs found in ${LABELER}`)
  }
  return globs
}

/** Minimal glob → RegExp: `**` spans separators, `*` does not. */
function globToRegExp(glob) {
  const source = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, ' ')
    .replace(/\*/g, '[^/]*')
    .replace(/ /g, '.*')
  return new RegExp(`^${source}$`)
}

const HUMAN_PATTERNS = humanGlobs().map(globToRegExp)

/**
 * Tier rules, first match wins. The human tier ultimately comes from
 * labeler.yml (see the override below); these rules add the finer
 * distinctions and the per-file reasons that a glob list can't express.
 */
const RULES = [
  {
    // First, and exempt from the human override below: a test file is a test
    // file wherever it lives, including under an auth path.
    test: (f) => /\.(test|spec)\./.test(f),
    tier: 'mechanical',
    why: 'tests — mechanically verified by the suite',
  },
  {
    test: (f) => /^packages\/[^/]+\/package\.json$/.test(f),
    tier: 'human',
    why: 'dependency or packaging change; check dep-vs-peer strategy and that frozen-lockfile CI passes',
  },
  {
    test: (f) => /\/src\/index\.ts$/.test(f),
    tier: 'human',
    why: 'published API surface changed — permanent contract once released',
  },
  {
    test: (f) => /^packages\/[^/]+\/src\/auth\//.test(f),
    tier: 'human',
    why: 'auth flow (OTP / magic link / passkey) — a silent break locks users out and no test drives the real provider',
  },
  {
    test: (f) => f.startsWith('packages/core/src/') || /\/src\/connector\.ts$/.test(f),
    tier: 'human',
    why: 'key handling / signing / session lifecycle',
  },
  {
    test: (f) => f.startsWith('.github/') || f.startsWith('scripts/'),
    tier: 'human',
    why: 'CI and review machinery — decides what is allowed to merge',
  },
  {
    // Release notes are prose, and the bump tier is patch by convention. Only
    // a non-patch bump is a decision someone has to own.
    test: (f) => f.startsWith('.changeset/') && f.endsWith('.md'),
    tier: (f) =>
      /^\+.*:\s*(minor|major)\s*$/m.test(git(['diff', baseSha, '--', f]))
        ? 'human'
        : 'mechanical',
    why: 'release note; escalated only when the bump is not `patch`',
  },
  {
    test: (f) => f.startsWith('apps/') || f.endsWith('.md'),
    tier: 'mechanical',
    why: 'demo app / docs — contained blast radius',
  },
  {
    // Everything else that ships to consumers. Not a decision surface, but
    // its correctness rests on someone having run it.
    test: (f) => /^packages\/[^/]+\/src\//.test(f),
    tier: 'behavior',
    why: 'published behavior — run the affected flow, don’t just read it',
  },
]

const TIER = {
  human: { level: 'warning', dot: '🔴', label: 'human' },
  behavior: { level: 'notice', dot: '🟡', label: 'skim' },
  mechanical: { level: 'notice', dot: '🟢', label: 'ai-verified' },
}

/** First added/changed line of a file, so the annotation lands on a line
 * that's actually in the diff. Falls back to 1 for pure deletions. */
function firstChangedLine(file) {
  const hunks = git(['diff', '-U0', '--no-color', baseSha, '--', file])
  const m = hunks.match(/^@@ -\d+(?:,\d+)? \+(\d+)/m)
  const line = m ? Number(m[1]) : 1
  return line > 0 ? line : 1
}

const files = git(['diff', '--name-only', baseSha]).trim().split('\n').filter(Boolean)

const rows = []
for (const file of files) {
  const rule = RULES.find((r) => r.test(file))
  // Unmatched files default to behavior tier: not a known decision surface,
  // but not mechanically verified either — someone should look.
  let tier = typeof rule?.tier === 'function' ? rule.tier(file) : rule?.tier
  tier ??= 'behavior'
  const why = rule?.why ?? 'not covered by a tier rule — review on merit'
  // labeler.yml is authoritative for the human tier: if a path is labelled
  // review:human, the map must not quietly rank it lower. Test files are the
  // one exception — the glob covering a directory covers its tests too, and a
  // test is verified by running it.
  const isTest = /\.(test|spec)\./.test(file)
  if (tier !== 'human' && !isTest && HUMAN_PATTERNS.some((re) => re.test(file))) {
    rows.push({ file, tier: 'human', why: `${why} (review:human path)` })
    continue
  }
  rows.push({ file, tier, why })
}

const order = { human: 0, behavior: 1, mechanical: 2 }
rows.sort((a, b) => order[a.tier] - order[b.tier] || a.file.localeCompare(b.file))

if (MARKDOWN) {
  const counts = rows.reduce((acc, r) => ({ ...acc, [r.tier]: (acc[r.tier] ?? 0) + 1 }), {})
  console.log('## 🔀 Review attention map')
  console.log('')
  console.log(
    `Start with the 🔴 files — they carry the decisions. ` +
      `(${counts.human ?? 0} human · ${counts.behavior ?? 0} skim · ${counts.mechanical ?? 0} ai-verified)`,
  )
  console.log('')
  console.log('| File | Attention | Why |')
  console.log('|---|---|---|')
  for (const { file, tier, why } of rows) {
    const t = TIER[tier]
    console.log(`| \`${file}\` | ${t.dot} ${t.label} | ${why} |`)
  }
  console.log('')
  console.log(
    '<sub>Generated by `scripts/review-attention.mjs`. Human tier is read from ' +
      '`.github/labeler.yml`; see `.github/review-rubric.md`.</sub>',
  )
} else {
  for (const { file, tier, why } of rows) {
    const t = TIER[tier]
    const line = firstChangedLine(file)
    const prefix = tier === 'human' ? 'HUMAN REVIEW — ' : ''
    console.log(`::${t.level} file=${file},line=${line}::${prefix}${why}`)
  }
}
