'use client'

import { ZeroDevLogo } from '@zerodev/react-ui'
import { ConnectWallet, SignUp, useAuth } from '@zerodev/wallet-react-ui'
import { Loader2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Fragment, useEffect, useMemo } from 'react'
import { useAccount, useConnect } from 'wagmi'
import {
  type AuthMethodId,
  pickConfigParams,
  resolveWalletConfig,
} from '../lib/config-params'
import { AppHeader } from './AppHeader'

// The auth methods the URL selected, rendered as SignUp units in a fixed
// order. Mirrors the resolved config the connector was built from.
const UNIT_BY_METHOD: Record<AuthMethodId, () => React.ReactNode> = {
  passkey: () => <SignUp.Passkey />,
  google: () => <SignUp.Google />,
  email: () => <SignUp.Email />,
}
const METHOD_ORDER: AuthMethodId[] = ['passkey', 'google', 'email']

/**
 * Login surface for the QA lab. Unlike the signer demo's landing page this
 * doesn't navigate anywhere on success — the root route re-renders the lab in
 * place once wagmi reports `connected`.
 */
export function LoginScreen() {
  const { connect, connectors, status: connectStatus } = useConnect()
  const { isConnected, status: accountStatus } = useAccount()
  const { step: authStep } = useAuth()

  // Resolve the same URL params the connector was built from, so the rendered
  // methods and email flow match the config under test (see Providers).
  const searchParams = useSearchParams()
  const configKey = pickConfigParams(searchParams).toString()
  const resolved = useMemo(
    () => resolveWalletConfig(new URLSearchParams(configKey)),
    [configKey],
  )
  const pickedMethods = METHOD_ORDER.filter((m) =>
    resolved.authMethods.includes(m),
  )

  // Auth has succeeded (ConnectWallet unmounts once step hits `authenticated`) but
  // wagmi hasn't flipped `isConnected` yet. Cover that window with a loader so
  // the column doesn't sit blank before the lab swaps in.
  const isSettling = isConnected || authStep === 'authenticated'
  // wagmi failed to (re)connect — offer a manual Reconnect instead of a
  // misleading CTA.
  const showReconnect =
    !isConnected && authStep === null && connectStatus === 'error'
  // ConnectWallet renders nothing until it has a `step`, so any time we're not
  // connected and have no step yet — initial session probe, auto-connect in
  // flight, or landing back here right after logout — show the loader.
  const showLoading =
    isSettling || (!isConnected && authStep === null && !showReconnect)

  const handleReconnect = () => {
    if (connectors[0]) connect({ connector: connectors[0] })
  }

  useEffect(() => {
    if (isConnected) return
    if (
      accountStatus === 'disconnected' &&
      connectStatus === 'idle' &&
      connectors[0]
    ) {
      connect({ connector: connectors[0] })
    }
  }, [isConnected, accountStatus, connectStatus, connect, connectors])

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="flex min-h-[calc(100vh-88px)] flex-col items-center justify-center px-4 py-8">
        {showLoading ? (
          <Loader2 className="h-10 w-10 animate-spin text-[var(--muted)]" />
        ) : showReconnect ? (
          <button
            type="button"
            onClick={handleReconnect}
            className="cursor-pointer rounded-3xl bg-[var(--ink)] px-8 py-4 text-body1 font-semibold text-white hover:bg-[#2a1c13]"
          >
            Reconnect
          </button>
        ) : (
          <>
            <p className="mb-6 text-center text-sm font-semibold uppercase tracking-[0.22em] text-[#9c958c]">
              Sign in to open the QA Lab
            </p>
            <ConnectWallet
              size="md"
              logo={
                <ZeroDevLogo
                  variant="mark"
                  tone="color"
                  className="zd:h-8 zd:w-auto"
                />
              }
              renderSignUp={() => (
                <SignUp emailAuthMethod={resolved.emailAuthMethod}>
                  {pickedMethods.map((method) => (
                    <Fragment key={method}>{UNIT_BY_METHOD[method]()}</Fragment>
                  ))}
                </SignUp>
              )}
            />
          </>
        )}
      </main>
    </div>
  )
}
