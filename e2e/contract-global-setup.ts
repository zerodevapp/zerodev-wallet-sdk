/**
 * Fails the contract run immediately when it is misconfigured, rather than
 * letting every test skip itself and reporting green.
 *
 * `ZD_PROJECT_ID` is checked here — not in `scripts/check-contract-ran.mjs`
 * — for two reasons:
 *
 *   1. It is *always* our error. An unreachable KMS or a downed temp-email
 *      service is transient infrastructure; a missing project id is a broken
 *      config that no retry will fix.
 *   2. Failing here costs a second. Letting the suite run first costs the full
 *      `waitForBackend` retry budget across six serial files (~50s observed)
 *      before arriving at the same conclusion.
 *
 * Everything else — including "the backend was unreachable so nothing ran" —
 * is decided after the fact from the JSON report by the checker script, since
 * that distinction is only knowable once the suite has finished.
 */

export default function setup(): void {
  if (!process.env.ZD_PROJECT_ID) {
    throw new Error(
      'ZD_PROJECT_ID is not set, so every contract test would skip itself ' +
        'and the run would falsely report success.\n\n' +
        'Local: copy `.env.example` to `.env` at the repo root and fill in ' +
        'ZD_PROJECT_ID.\n' +
        'CI: confirm the `ZD_PROJECT_ID` secret is populated and exposed to ' +
        'the contract-test job.',
    )
  }
}
