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

const GOOD_STAMP: Stamp = {
  stampHeaderName: 'X-Stamp',
  stampHeaderValue: 'a-real-der-signature',
}

/**
 * Creates a stamper that generates stamps based on the provided answer function.
 * @param answer A function that receives the call count and returns a promise resolving to a Stamp.
 * @returns A SigningStamper that uses the provided answer function to generate stamps.
 */
function stamperThat(answer: (call: number) => Promise<Stamp>): SigningStamper {
  let calls = 0
  return {
    stamp: async () => answer(++calls),
    sign: async () => 'sig',
    getPublicKey: async () => `02${'00'.repeat(32)}`,
    clear: async () => {},
  }
}

/**
 * Creates a stamper that always returns a valid stamp.
 * @returns A SigningStamper that always produces the GOOD_STAMP.
 */
const working = () => stamperThat(async () => GOOD_STAMP)

const throwingOn = (nth: number) =>
  stamperThat(async (call) => {
    if (call === nth) throw new Error('HSM unavailable')
    return GOOD_STAMP
  })

/**
 * Creates a stamper that returns a specific stamp on the nth call and GOOD_STAMP otherwise.
 * @param nth The call number on which the stamper should return the specified stamp.
 * @param stamp The stamp to return on the specified call.
 * @returns A SigningStamper that returns the given stamp on the nth call and GOOD_STAMP otherwise.
 */
const answeringOn = (nth: number, stamp: Stamp) =>
  stamperThat(async (call) => (call === nth ? stamp : GOOD_STAMP))

/**
 * Creates a server wallet instance with the given stamper and a fetch spy for testing.
 * @param stamper The stamper to use for signing requests.
 * @returns An object containing the created wallet and a fetch spy.
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

/** 1 is the stamp over the Turnkey payload, 2 the stamp over the whole body. */
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
 *
 * @param outcome The outcome of a promise, either returned or threw.
 * @returns A string identifying the error, or 'NO ERROR' if none occurred.
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
 * Tests the behavior of the SDK when the stamper is healthy but refuses to provide a valid stamp.
 */
describe('a stamper that refuses: the healthy reaction, kept healthy', () => {
  for (const [name, run] of actions) {
    for (const [nth, which] of callSites) {
      it(`${name}: surfaces the stamper's own failure when it cannot stamp ${which}`, async () => {
        const { wallet, fetchSpy } = walletWith(throwingOn(nth))

        const outcome = await caught(run(wallet))

        expect(errorIdentity(outcome)).toBe('Error: HSM unavailable')
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

  it('control: a working stamper lands both stamps where the KMS reads them', async () => {
    const { wallet, fetchSpy } = walletWith(working())

    await caught(wallet.createWallet())

    expect(fetchSpy).toHaveBeenCalledTimes(1)

    const [, init] = fetchSpy.mock.calls[0] ?? []
    const headers = init?.headers as Record<string, string>
    const body = JSON.parse(String(init?.body))
    expect(body.stamp.stampHeaderValue).toBe(GOOD_STAMP.stampHeaderValue)
    expect(headers['X-Agent-Stamp']).toBe(GOOD_STAMP.stampHeaderValue)
  })
})

/**
 * A stamper that returns an unusable value should not allow the request to be sent.
 * The SDK must detect empty or missing stamps and refuse to proceed, ensuring that
 * no request with an invalid stamp reaches the network.
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
 * A stamper that resolves to nothing at all is a programming error in the
 * caller's own code, and the SDK reports it by dereferencing the result:
 * `TypeError: Cannot read properties of undefined (reading
 * 'stampHeaderValue')`, which names an internal field and not the stamper.
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
