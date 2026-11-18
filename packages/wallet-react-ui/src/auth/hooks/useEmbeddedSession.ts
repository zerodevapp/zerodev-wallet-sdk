import { useConnections } from 'wagmi'

/** The id the kit connector registers under (see `@zerodev/react`). */
export const KIT_CONNECTOR_ID = 'zerodev-wallet'

/**
 * True while the embedded wallet holds a wagmi connection: the user signed
 * in with a passkey, Google or email and has not signed out. The sign-up
 * units that start one of those logins hide behind it, so a sheet opened
 * while signed in (to add a Solana wallet, say) cannot offer a second login
 * over the live session.
 */
export function useEmbeddedSession(): boolean {
  const connections = useConnections()
  return connections.some(({ connector }) => connector.id === KIT_CONNECTOR_ID)
}
