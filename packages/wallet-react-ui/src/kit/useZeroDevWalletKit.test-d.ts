/**
 * Type tests for the `useZeroDevWalletKit` overloads: what a call returns
 * must match what the runtime hands back, whichever way the options are
 * written. A mismatch here is a call that type-checks and then throws.
 */
import { describe, expectTypeOf, it } from 'vitest'
import type { KitAdapter, ZeroDevWalletKit } from './types'
import { useZeroDevWalletKit } from './useZeroDevWalletKit'

describe('useZeroDevWalletKit overloads', () => {
  it('returns the full kit without a namespace', () => {
    expectTypeOf(useZeroDevWalletKit()).toEqualTypeOf<ZeroDevWalletKit>()
    expectTypeOf(
      useZeroDevWalletKit({ reconnectOnMount: false }),
    ).toEqualTypeOf<ZeroDevWalletKit>()
    const options = { reconnectOnMount: false }
    expectTypeOf(useZeroDevWalletKit(options)).toEqualTypeOf<ZeroDevWalletKit>()
  })

  it('returns one adapter for a namespace given inline', () => {
    expectTypeOf(useZeroDevWalletKit({ namespace: 'solana' })).toEqualTypeOf<
      KitAdapter<'solana'>
    >()
    expectTypeOf(
      useZeroDevWalletKit({ namespace: 'eip155', reconnectOnMount: false }),
    ).toEqualTypeOf<KitAdapter<'eip155'>>()
  })

  it('returns one adapter for a namespace held in a variable', () => {
    // A variable is not a fresh literal, so it gets no excess-property
    // check: with the all-namespaces overload first this typed as the full
    // kit, and `.solana` on the adapter the runtime returns threw.
    const options = { namespace: 'solana' as const, reconnectOnMount: false }
    expectTypeOf(useZeroDevWalletKit(options)).toEqualTypeOf<
      KitAdapter<'solana'>
    >()
  })

  it('refuses a namespace that widened to string', () => {
    // Neither overload takes it, so the error lands on the call, where the
    // fix (`as const`) is, rather than at runtime.
    const options = { namespace: 'solana', reconnectOnMount: false }
    // @ts-expect-error -- `string` is not a KitNamespace, and the
    // all-namespaces overload takes no namespace at all
    useZeroDevWalletKit(options)
  })
})
