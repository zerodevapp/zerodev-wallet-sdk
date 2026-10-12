import { type Mock, vi } from 'vitest'
import type { SolanaWcProvider, SolanaWcSession } from './wallet'

export type FakeWcProvider = SolanaWcProvider & {
  connect: Mock<SolanaWcProvider['connect']>
  disconnect: Mock<SolanaWcProvider['disconnect']>
  request: Mock<SolanaWcProvider['request']>
  abortPairingAttempt: Mock<() => void>
  emit: (event: string, ...args: unknown[]) => void
}

/** A `UniversalProvider` double: a session slot, a working event emitter and
 * mockable connect/disconnect/request. Tests set `session` or override
 * `connect` to model a wallet's answer. */
export function fakeWcProvider(session?: SolanaWcSession): FakeWcProvider {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()
  const provider: FakeWcProvider = {
    session,
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {
      provider.session = undefined
    }),
    request: vi.fn(),
    abortPairingAttempt: vi.fn(),
    on: (event, listener) => {
      listeners.set(event, (listeners.get(event) ?? new Set()).add(listener))
    },
    off: (event, listener) => {
      listeners.get(event)?.delete(listener)
    },
    emit: (event, ...args) => {
      for (const l of listeners.get(event) ?? []) l(...args)
    },
  }
  return provider
}

/** A settled session with the given `solana` accounts. */
export function fakeWcSession(
  accounts: string[],
  {
    name = 'Phantom',
    icons = ['https://phantom.app/icon.png'],
    methods,
  }: { name?: string; icons?: string[]; methods?: string[] } = {},
): SolanaWcSession {
  return {
    namespaces: { solana: { accounts, ...(methods && { methods }) } },
    peer: { metadata: { name, icons } },
  }
}
