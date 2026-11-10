/**
 * Boundary: the server wallet client <-> the agent key it stamps with.
 */
import type { Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RestRequestError } from '../../errors/request.js'
import { createZeroDevServerWallet } from '../../server/createZeroDevServerWallet.js'
import type { SigningStamper, Stamp } from '../../stampers/types.js'

const OWNER = privateKeyToAccount(`0x${'11'.repeat(32)}` as Hex)
const PROJECT = 'proj'
const ORG = 'wallet-set-sub-org'
const BASE_URL = 'https://kms.test.invalid/api/v1'

/**
 * Distinct per call, so the control can tell the inner stamp from the outer
 * one. A single shared value passes just as well when the two are swapped,
 * which is the mistake the KMS would reject and this file exists to catch.
 */
const stampFor = (call: number): Stamp => ({
  stampHeaderName: 'X-Stamp',
  stampHeaderValue: `stamp-${call}`,
})

/** 1 is the stamp over the Turnkey payload, 2 the stamp over the whole body. */
const INNER_STAMP = stampFor(1).stampHeaderValue
const OUTER_STAMP = stampFor(2).stampHeaderValue

/** `answer` is given the call number, counted per stamper instance. */
function stamperThat(answer: (call: number) => Promise<Stamp>): SigningStamper {
  let calls = 0
  return {
    stamp: async () => answer(++calls),
    sign: async () => 'sig',
    getPublicKey: async () => `02${'00'.repeat(32)}`,
    clear: async () => {},
  }
}

const working = () => stamperThat(async (call) => stampFor(call))

const throwingOn = (nth: number) =>
  stamperThat(async (call) => {
    if (call === nth) throw new Error('HSM unavailable')
    return stampFor(call)
  })

const answeringOn = (nth: number, stamp: Stamp) =>
  stamperThat(async (call) => (call === nth ? stamp : stampFor(call)))

/**
 * A real server wallet over the given stamper. Every request is answered 401,
 * so anything that does reach the wire is distinguishable from a local refusal
 * by the error that comes back.
 */
function walletWith(stamper: SigningStamper) {
  const fetchSpy = vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          error: 'unauthorized',
          message: 'stamp verification failed',
        }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      ),
  )
  vi.stubGlobal('fetch', fetchSpy)

  const wallet = createZeroDevServerWallet({
    projectId: PROJECT,
    organizationId: ORG,
    stamper,
    proxyBaseUrl: BASE_URL,
  })
  return { wallet, fetchSpy }
}

type Wallet = ReturnType<typeof walletWith>['wallet']

const actions: [string, (w: Wallet) => Promise<unknown>][] = [
  ['createWallet', (w) => w.createWallet()],
  [
    'signMessage',
    (w) =>
      w.client.signMessage({
        projectId: PROJECT,
        address: OWNER.address,
        message: 'hello',
        encoding: 'utf8',
      }),
  ],
]

const callSites: [number, string][] = [
  [1, 'the inner payload'],
  [2, 'the whole body'],
]

type Outcome = { returned: unknown } | { threw: unknown }

const caught = (p: Promise<unknown>): Promise<Outcome> =>
  p.then(
    (returned) => ({ returned }),
    (threw: unknown) => ({ threw }),
  )

/**
 * `name: message`, so an assertion can say which error arrived rather than
 * only that one did. `NO ERROR` when the call resolved, which reads better in
 * a failure than `undefined`.
 */
function errorIdentity(outcome: Outcome): string {
  if (!('threw' in outcome)) return 'NO ERROR'
  const error = outcome.threw
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : `non-error: ${String(error)}`
}

afterEach(() => {
  vi.unstubAllGlobals()
})

/**
 * The guard that does exist: a stamper that throws stops the request, and the
 * stamper's own message reaches the caller rather than being swallowed.
 */
describe('a stamper that refuses: the healthy reaction, kept healthy', () => {
  for (const [name, run] of actions) {
    for (const [nth, which] of callSites) {
      it(`${name}: surfaces the stamper's own failure when it cannot stamp ${which}`, async () => {
        const { wallet, fetchSpy } = walletWith(throwingOn(nth))

        const outcome = await caught(run(wallet))

        // Matched, not compared. Wrapping this in an SDK error with the
        // stamper's as `cause` would be a fix, not a regression, and an exact
        // string would call it one.
        expect(errorIdentity(outcome)).toMatch(/HSM unavailable/)
        expect(fetchSpy).not.toHaveBeenCalled()
      })
    }
  }

  it('control: a rejected key is a remote refusal, with the request actually made', async () => {
    const { wallet, fetchSpy } = walletWith(working())

    const outcome = await caught(wallet.createWallet())

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect('threw' in outcome).toBe(true)
    const error = (outcome as { threw: unknown }).threw as RestRequestError
    expect(error).toBeInstanceOf(RestRequestError)
    expect(error.status).toBe(401)
  })

  it('control: a working stamper lands each stamp where the KMS reads it', async () => {
    const { wallet, fetchSpy } = walletWith(working())

    await caught(wallet.createWallet())

    expect(fetchSpy).toHaveBeenCalledTimes(1)

    const [, init] = fetchSpy.mock.calls[0] ?? []
    const headers = init?.headers as Record<string, string>
    const body = JSON.parse(String(init?.body))

    // The inner stamp travels in the body and the outer one in the header.
    // Swapping them is what the KMS rejects, so the two values differ here.
    expect(body.stamp.stampHeaderValue).toBe(INNER_STAMP)
    expect(headers['X-Agent-Stamp']).toBe(OUTER_STAMP)
  })
})

/**
 * No guard exists yet: a stamp that resolves to an empty or absent value is
 * put on the wire, and the 401 the KMS answers with is what the caller sees.
 * The markers assert the refusal that should happen instead.
 */
describe('a stamper that answers with nothing usable', () => {
  const unusable: [string, Stamp][] = [
    ['an empty value', { stampHeaderName: 'X-Stamp', stampHeaderValue: '' }],
    ['no value at all', { stampHeaderName: 'X-Stamp' } as Stamp],
  ]

  for (const [name, run] of actions) {
    for (const [label, stamp] of unusable) {
      for (const [nth, which] of callSites) {
        it.fails(
          `${name}: refuses to send when the stamper returns ${label} for ${which}`,
          async () => {
            const { wallet, fetchSpy } = walletWith(answeringOn(nth, stamp))

            const outcome = await caught(run(wallet))

            expect(fetchSpy).not.toHaveBeenCalled()
            expect(errorIdentity(outcome)).toMatch(
              /empty|missing|no stamp|produced nothing|not signed/i,
            )
          },
        )
      }
    }
  }
})

/**
 * A stamper resolving to nothing at all is a programming error in the caller's
 * own code, and the SDK reports it by dereferencing the result:
 * `TypeError: Cannot read properties of undefined (reading
 * 'stampHeaderValue')`, which names an internal field and not the stamper.
 * The markers assert the attributable error that should replace it.
 */
describe('a stamper that resolves to nothing', () => {
  for (const [name, run] of actions) {
    for (const [nth, which] of callSites) {
      it.fails(
        `${name}: blames the stamper rather than throwing a TypeError for ${which}`,
        async () => {
          const { wallet, fetchSpy } = walletWith(
            answeringOn(nth, undefined as unknown as Stamp),
          )

          const outcome = await caught(run(wallet))

          expect('threw' in outcome).toBe(true)
          expect((outcome as { threw: unknown }).threw).not.toBeInstanceOf(
            TypeError,
          )
          expect(errorIdentity(outcome)).toMatch(/stamper/i)
          expect(fetchSpy).not.toHaveBeenCalled()
        },
      )
    }
  }
})
