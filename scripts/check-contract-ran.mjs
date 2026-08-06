#!/usr/bin/env node
/**
 * Guards against a green contract job that never talked to the KMS.
 *
 * Every file in `e2e/contract/` calls `context.skip()` from `beforeAll`
 * when the backend is unreachable, the temp-email service is down, or
 * `ZD_PROJECT_ID` is unset. Vitest counts a fully skipped file as passed and
 * exits 0, so the job reported success while running nothing:
 *
 *     Test Files  6 passed (6)
 *          Tests  9 skipped (9)          exit 0
 *
 * Policy implemented here:
 *   - zero tests executed          -> FAIL (the run proved nothing)
 *   - some executed, some skipped  -> PASS + a visible warning
 *   - a test executed and failed   -> PASS here; vitest already failed the run,
 *                                     and adding a second reason only confuses
 *
 * `ZD_PROJECT_ID` is handled separately (see `e2e/contract-global-setup.ts`)
 * so a config error fails immediately instead of after the full suite timeout.
 *
 * Usage: node scripts/check-contract-ran.mjs <vitest-json-report>
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Allowlist, so any status vitest adds later counts as "did not run". */
const EXECUTED = new Set(['passed', 'failed'])

/**
 * @param {unknown} report Parsed `vitest --reporter=json` output.
 * @returns {{ok: boolean, executed: number, skipped: number, skippedTests: string[], reason?: string}}
 */
export function evaluateContractRun(report) {
  const empty = { executed: 0, skipped: 0, skippedTests: [] }

  if (
    !report ||
    typeof report !== 'object' ||
    !Array.isArray(/** @type {any} */ (report).testResults)
  ) {
    return {
      ok: false,
      ...empty,
      reason:
        'Contract report is malformed or unreadable (no `testResults` array).',
    }
  }

  const assertions = /** @type {any} */ (report).testResults.flatMap(
    (file) => (Array.isArray(file?.assertionResults) ? file.assertionResults : []),
  )

  const executed = assertions.filter((a) => EXECUTED.has(a?.status)).length
  const skippedTests = assertions
    .filter((a) => !EXECUTED.has(a?.status))
    .map((a) => a?.fullName ?? a?.title ?? '<unnamed test>')
  const skipped = skippedTests.length

  if (/** @type {any} */ (report).testResults.length === 0) {
    return {
      ok: false,
      ...empty,
      reason:
        'Contract report contains no test files — the suite never matched anything.',
    }
  }

  if (executed === 0) {
    return {
      ok: false,
      executed,
      skipped,
      skippedTests,
      reason:
        `No contract test actually ran (${skipped} skipped). A green job here ` +
        'would mean nothing: the KMS was unreachable, the email service was down, ' +
        'or the suite was misconfigured.',
    }
  }

  return { ok: true, executed, skipped, skippedTests }
}

/** Emits GitHub Actions annotations when running in CI; plain text otherwise. */
function emit(result) {
  const inCI = Boolean(process.env.GITHUB_ACTIONS)
  const lines = []

  if (!result.ok) {
    lines.push(inCI ? `::error::${result.reason}` : `ERROR: ${result.reason}`)
  } else if (result.skipped > 0) {
    const msg =
      `${result.skipped} of ${result.skipped + result.executed} contract tests skipped ` +
      `(${result.executed} ran). Likely a third-party outage rather than a code change.`
    lines.push(inCI ? `::warning::${msg}` : `WARNING: ${msg}`)
  } else {
    lines.push(`All ${result.executed} contract tests ran.`)
  }

  for (const name of result.skippedTests) {
    lines.push(`  skipped: ${name}`)
  }

  console.log(lines.join('\n'))
}

// CLI entry — skipped when imported by tests.
if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
  const reportPath = process.argv[2]
  if (!reportPath) {
    console.error('Usage: node scripts/check-contract-ran.mjs <vitest-json-report>')
    process.exit(2)
  }

  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
  } catch (err) {
    const msg = `Could not read the contract report at ${reportPath}: ${err.message}`
    console.error(process.env.GITHUB_ACTIONS ? `::error::${msg}` : `ERROR: ${msg}`)
    process.exit(1)
  }

  const result = evaluateContractRun(parsed)
  emit(result)
  process.exit(result.ok ? 0 : 1)
}
