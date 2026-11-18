'use client'

import { useAuth } from '@zerodev/wallet-react-ui'
import { Loader2 } from 'lucide-react'
import { useAccount, useConnect } from 'wagmi'


/**
 * The signed-out body. The shell owns the header and the connector bar, which
 * stay mounted across the gate, so this is only what fills the column below
 * them: a hint at rest, nothing while the sign-up flow is open over the page.
 */
export function LoginScreen() {
  const { connect, connectors, status: connectStatus } = useConnect()
  const { isConnected } = useAccount()
  const { step: authStep } = useAuth()

  // Auth has succeeded (ConnectWallet unmounts once step hits `authenticated`) but
  // wagmi hasn't flipped `isConnected` yet. Cover that window with a loader so
  // the column doesn't sit blank before the lab swaps in.
  const isSettling = isConnected || authStep === 'authenticated'
  // wagmi failed to (re)connect — offer a manual Reconnect instead of a
  // misleading CTA.
  const showReconnect =
    !isConnected && authStep === null && connectStatus === 'error'
  const inFlight = authStep !== null && authStep !== 'authenticated'

  const handleReconnect = () => {
    if (connectors[0]) connect({ connector: connectors[0] })
  }

  return (
    <main className="flex min-h-[calc(100vh-88px)] flex-col items-center justify-center px-4 py-8">
        {isSettling ? (
          <Loader2 className="h-10 w-10 animate-spin text-[var(--muted)]" />
        ) : showReconnect ? (
          <button
            type="button"
            onClick={handleReconnect}
            className="cursor-pointer rounded-3xl bg-[var(--ink)] px-8 py-4 text-body1 font-semibold text-white hover:bg-[#2a1c13]"
          >
            Reconnect
          </button>
        ) : inFlight ? null : (
          <p
            className="text-center text-sm font-semibold uppercase tracking-[0.22em] text-[#9c958c]"
            data-testid="signed-out-hint"
          >
            Pick a namespace to connect above
          </p>
      )}
    </main>
  )
}
