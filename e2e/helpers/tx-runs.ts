import { expect, type Locator, test } from '@playwright/test'

/**
 * A sponsored userOp on staging can take a while, and the run stays `pending`
 * for all of it. Pending is not a failure, only an explicit `error` is, so
 * this is a cap on a stuck run rather than how long one is expected to take.
 */
const TX_SETTLE_TIMEOUT_MS = 150_000

/** Headroom over the settle budget so the test's own timeout never cuts it short. */
const TEST_BUDGET_HEADROOM_MS = 60_000

/** Signing is a KMS round trip, with no chain to wait for. */
const SIGN_SETTLE_TIMEOUT_MS = 30_000

/**
 * Staging's RPC and paymaster sit behind a shared per-project rate limit, and
 * `pm_getPaymasterData` is not retried (`@zerodev/sdk` forces `retryCount: 0` on
 * the paymaster transport), so one throttled burst fails the transaction for
 * good. Matched on the server's own wording plus the status the lab now renders,
 * only to label the failure — a throttle still fails the test.
 */
const RATE_LIMITED = /rate limit|HTTP 429/i

/**
 * Waits for a run to reach a terminal state and fails with its reason.
 *
 * Waits for `success` *or* `error` rather than `success` alone: a failed run is
 * already final within seconds, so waiting only for success spends the whole
 * timeout and then reports a timeout instead of the reason. On error the run's
 * `data-error` is read back and attached as an annotation before failing, so the
 * report says whether staging throttled us or the SDK actually broke — the two
 * belong to different owners, and a bare status assertion said neither.
 *
 * A run still `pending` is the third case and is not a failure: the submit is
 * in flight. It gets the full budget, and if it never settles the message says
 * which status it was stuck on rather than reporting a bare timeout.
 */
async function settle(
  run: Locator,
  { noun, kind }: { noun: string; kind: string },
  timeout: number,
): Promise<void> {
  // Raised here rather than in each spec: the budget belongs to how long a run
  // may legitimately stay pending, which is this helper's business.
  const needed = timeout + TEST_BUDGET_HEADROOM_MS
  if (test.info().timeout < needed) test.setTimeout(needed)

  try {
    await expect(run).toHaveAttribute('data-status', /^(success|error)$/, {
      timeout,
    })
  } catch {
    // Named rather than left as a bare timeout: a run still `pending` has not
    // failed, it is stuck or slow, and that is a different owner from a run
    // that reported an error.
    const status = (await run.getAttribute('data-status')) ?? 'none'
    throw new Error(
      `${noun} run never settled: still "${status}" after ${Math.round(
        timeout / 1000,
      )}s, having reported neither success nor error.`,
    )
  }

  if ((await run.getAttribute('data-status')) === 'error') {
    const detail =
      (await run.getAttribute('data-error')) ?? 'no error text rendered'
    test.info().annotations.push({
      type: RATE_LIMITED.test(detail)
        ? 'staging-rate-limit'
        : `${kind}-failure`,
      description: detail,
    })
    throw new Error(`${noun} run failed: ${detail}`)
  }
}

/** Waits for a tx run to settle and asserts it succeeded with a real hash. */
export async function expectTxRunSucceeded(run: Locator): Promise<void> {
  await settle(run, { noun: 'Transaction', kind: 'tx' }, TX_SETTLE_TIMEOUT_MS)

  await expect(run.getByTestId('tx-run-hash')).toHaveAttribute(
    'data-hash',
    /^0x[0-9a-fA-F]{64}$/,
  )
}

/**
 * Waits for a sign run to settle and asserts the signature verified.
 *
 * `data-verify` is the assertion that matters: the lab checks the returned
 * signature against the connected account for the exact message it sent, so a
 * run that resolved with anything at all does not pass.
 */
export async function expectSignRunSucceeded(run: Locator): Promise<void> {
  await settle(run, { noun: 'Signing', kind: 'sign' }, SIGN_SETTLE_TIMEOUT_MS)

  await expect(run).toHaveAttribute('data-verify', 'valid', {
    timeout: SIGN_SETTLE_TIMEOUT_MS,
  })
}

/** MetaMask reports a user rejection as EIP-1193 code 4001. */
const USER_REJECTED = /reject|denied|declined|4001/i

/**
 * Waits for a sign run to settle and asserts it failed **because the user
 * rejected**, rather than simply failing.
 */
export async function expectSignRunRejected(run: Locator): Promise<void> {
  await expect(run).toHaveAttribute('data-status', /^(success|error)$/, {
    timeout: SIGN_SETTLE_TIMEOUT_MS,
  })

  if ((await run.getAttribute('data-status')) === 'success') {
    throw new Error(
      'the sign run succeeded, so the rejection never reached the SDK',
    )
  }

  const detail =
    (await run.getAttribute('data-error')) ?? 'no error text rendered'
  test.info().annotations.push({ type: 'sign-rejected', description: detail })

  expect(
    detail,
    'a rejected signature must be reported as a rejection, not as a generic failure',
  ).toMatch(USER_REJECTED)
}
