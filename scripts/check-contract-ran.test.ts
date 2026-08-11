import { describe, expect, it } from 'vitest'
import { evaluateContractRun } from './check-contract-ran.mjs'

/**
 * The contract job used to report green when the KMS was unreachable:
 * every test hits `context.skip()` in `beforeAll`, vitest counts a fully
 * skipped file as passed, and the run exits 0. A green badge was therefore
 * equally consistent with "everything works" and "nothing ran".
 *
 * `evaluateContractRun` is what restores meaning to that badge, so it is
 * itself the thing most worth testing: if it is wrong, CI lies.
 *
 * Fixtures mirror the real `--reporter=json` payload (captured from an actual
 * run against an unreachable KMS), not an assumed shape. That payload has one
 * `testResults` entry *per file* — the repro was 6 files / 9 tests — so most
 * fixtures here span several files rather than lumping tests into one.
 */

type Status = 'passed' | 'failed' | 'skipped'

function assertion(fullName: string, status: Status, suite = 'Contract Flow') {
  return {
    ancestorTitles: [suite],
    fullName: `${suite} ${fullName}`,
    status,
    title: fullName,
    duration: 0.74,
    failureMessages: [],
    meta: {},
    tags: [],
  }
}

/** One `testResults` entry per inner array, matching the real reporter shape. */
function reportFromFiles(files: ReturnType<typeof assertion>[][]) {
  const all = files.flat()
  const count = (s: Status) => all.filter((a) => a.status === s).length
  return {
    numTotalTestSuites: files.length,
    numPassedTestSuites: files.length,
    numFailedTestSuites: 0,
    numPendingTestSuites: 0,
    numTotalTests: all.length,
    numPassedTests: count('passed'),
    numFailedTests: count('failed'),
    numPendingTests: count('skipped'),
    numTodoTests: 0,
    snapshot: {},
    startTime: 1_700_000_000_000,
    success: count('failed') === 0,
    testResults: files.map((assertions, i) => ({
      assertionResults: assertions,
      startTime: 1_700_000_000_000,
      endTime: 1_700_000_001_000,
      status: 'passed',
      message: '',
      name: `/repo/e2e/contract/flow-${i}.test.ts`,
    })),
  }
}

const report = (assertions: ReturnType<typeof assertion>[]) =>
  reportFromFiles([assertions])

describe('evaluateContractRun', () => {
  it('rejects a run where every test skipped, even though vitest reported success', () => {
    const result = evaluateContractRun(
      report([
        assertion('OTP login works', 'skipped'),
        assertion('OTP resend works', 'skipped'),
      ]),
    )

    // The exact case that made CI unfalsifiable.
    expect(result.ok).toBe(false)
    expect(result.executed).toBe(0)
    expect(result.skipped).toBe(2)
    expect(result.reason).toMatch(/no contract test actually ran/i)
  })

  it('accepts a run where at least one test executed against the KMS', () => {
    const result = evaluateContractRun(
      report([
        assertion('OTP login works', 'passed'),
        assertion('OTP resend works', 'skipped'),
      ]),
    )

    expect(result.ok).toBe(true)
    expect(result.executed).toBe(1)
    expect(result.skipped).toBe(1)
  })

  it('sums skips across every file, not just the first', () => {
    // The real report is one entry per file. Reading only `testResults[0]`
    // would undercount and could pass a run where nothing executed.
    const result = evaluateContractRun(
      reportFromFiles([
        [assertion('OTP login works', 'skipped', 'OTP Flow')],
        [assertion('magic link round-trips', 'skipped', 'Magic Link')],
        [assertion('wallet export succeeds', 'skipped', 'Wallet Export')],
      ]),
    )

    expect(result.ok).toBe(false)
    expect(result.skipped).toBe(3)
    expect(result.skippedTests).toHaveLength(3)
  })

  it('finds an executed test even when it is in a later file', () => {
    // Sharpest guard against per-file aggregation regressing: the only test
    // that ran lives in the last file, so ignoring files after the first
    // would wrongly fail the run.
    const result = evaluateContractRun(
      reportFromFiles([
        [assertion('OTP login works', 'skipped', 'OTP Flow')],
        [assertion('magic link round-trips', 'skipped', 'Magic Link')],
        [assertion('wallet export succeeds', 'passed', 'Wallet Export')],
      ]),
    )

    expect(result.ok).toBe(true)
    expect(result.executed).toBe(1)
    expect(result.skipped).toBe(2)
  })

  it('treats an unrecognized or missing status as not executed', () => {
    // Fail-open here would recreate the original bug via reporter schema
    // drift: a renamed or newly added status would make skipped tests look
    // executed and hand back a meaningless green.
    const result = evaluateContractRun(
      reportFromFiles([
        [{ fullName: 'status-less test', title: 'status-less test' } as never],
      ]),
    )

    expect(result.ok).toBe(false)
    expect(result.executed).toBe(0)
    expect(result.skippedTests).toEqual(['status-less test'])
  })

  it('counts a failed test as executed — vitest already fails the run, we must not mask it', () => {
    const result = evaluateContractRun(
      report([assertion('OTP login works', 'failed')]),
    )

    // A real assertion failure means the KMS was reached. This checker exists
    // only to catch "nothing ran", so it must not add a second, confusing
    // failure reason on top of vitest's own. Reachable in CI because the
    // check runs as its own `if: always()` step.
    expect(result.ok).toBe(true)
    expect(result.executed).toBe(1)
  })

  it('names the skipped tests so the CI annotation is actionable', () => {
    const result = evaluateContractRun(
      reportFromFiles([
        [assertion('OTP login works', 'passed', 'OTP Flow')],
        [assertion('round-trips', 'skipped', 'Magic Link')],
        [assertion('succeeds', 'skipped', 'Wallet Export')],
      ]),
    )

    expect(result.skippedTests).toEqual([
      'Magic Link round-trips',
      'Wallet Export succeeds',
    ])
  })

  it('reports no skips when the whole suite ran', () => {
    const result = evaluateContractRun(
      report([
        assertion('OTP login works', 'passed'),
        assertion('magic link round-trips', 'passed'),
      ]),
    )

    expect(result.ok).toBe(true)
    expect(result.skipped).toBe(0)
    expect(result.skippedTests).toEqual([])
  })

  it('rejects a report with no test files rather than treating it as a pass', () => {
    // `vitest run` with a bad --config or a glob that matches nothing produces
    // an empty report. Silently passing here would reintroduce the same blind
    // spot through a different door, so it gets its own actionable message.
    const result = evaluateContractRun({
      ...report([]),
      testResults: [],
    })

    expect(result.ok).toBe(false)
    expect(result.executed).toBe(0)
    expect(result.reason).toMatch(/no test files/i)
  })

  it('rejects a malformed report instead of throwing', () => {
    const result = evaluateContractRun({} as never)

    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/malformed|unreadable/i)
  })
})
