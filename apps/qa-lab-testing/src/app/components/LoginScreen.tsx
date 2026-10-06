'use client'

import { ZeroDevLogo } from '@zerodev/react-ui'
import {
  ConnectWallet,
  SignUp,
  useAuth,
  useSolanaAccount,
} from '@zerodev/wallet-react-ui'
import { Loader2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Fragment, useEffect, useMemo } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { pickConfigParams, resolveWalletConfig } from '../lib/config-params'
import { useAuthPreset } from '../lib/use-auth-preset'
import { AUTH_PRESETS, type AuthUnitId } from '../lib/wallet-config'
import { AppHeader } from './AppHeader'
import { SolanaAccountStrip } from './SolanaAccountStrip'

/**
 * Which units a preset renders, and in what order,
 * lives in `wallet-config.ts` → `AUTH_PRESETS[...].units`, which stays free of
 * JSX so server components can import it.
 */
const UNIT_BY_ID: Record<AuthUnitId, () => React.ReactNode> = {
  passkey: () => <SignUp.Passkey />,
  google: () => <SignUp.Google />,
  email: () => <SignUp.Email />,
  divider: () => <SignUp.Divider />,
  'wallet:metamask': () => <SignUp.Wallet walletId="metamask" />,
  installedWallets: () => <SignUp.InstalledWallets />,
  moreWallets: () => <SignUp.MoreWallets />,
  walletConnect: () => <SignUp.WalletConnect />,
}

/**
 * Login surface for the QA lab. Unlike the signer demo's landing page this
 * doesn't navigate anywhere on success — the root route re-renders the lab in
 * place once wagmi reports `connected`.
 */
export function LoginScreen() {
  const { connect, connectors, status: connectStatus } = useConnect()
  const { isConnected, status: accountStatus } = useAccount()
  const { step: authStep } = useAuth()
  const solanaConnected = useSolanaAccount().isConnected

  // Resolve the same URL params the connector was built from, so the email
  // flow matches the config under test (see Providers).
  const searchParams = useSearchParams()
  const configKey = pickConfigParams(searchParams).toString()
  const resolved = useMemo(
    () => resolveWalletConfig(new URLSearchParams(configKey)),
    [configKey],
  )

  // The preset can come from localStorage, which neither the server nor the
  // first client render can read, so `ready` gates the sign-in column below.
  const { preset, ready: presetReady } = useAuthPreset()

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
  // `!presetReady` too: rendering one preset's units and swapping them a frame
  // later is a hydration mismatch.
  const showLoading =
    isSettling ||
    !presetReady ||
    (!isConnected && authStep === null && !showReconnect)

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
          <>
            {/* Solana PoC: a Solana-only sign-in lands here, because closing
                the sign-up flow rejects the kit connector's pending EVM
                connect. The lab itself needs an EVM account, so keep the
                Solana connection visible and offer the EVM sign-in. */}
            <div className="mb-4 w-full max-w-md">
              <SolanaAccountStrip />
            </div>
            <button
              type="button"
              onClick={handleReconnect}
              className="cursor-pointer rounded-3xl bg-[var(--ink)] px-8 py-4 text-body1 font-semibold text-white hover:bg-[#2a1c13]"
            >
              {solanaConnected ? 'Sign in with an EVM wallet' : 'Reconnect'}
            </button>
          </>
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
                  {AUTH_PRESETS[preset].units.map((id) => (
                    <Fragment key={id}>{UNIT_BY_ID[id]()}</Fragment>
                  ))}
                  {/* Solana PoC: installed Solana wallets (Phantom, Solflare,
                      Backpack) via the Wallet Standard. Renders nothing when
                      none is installed. */}
                  <SignUp.Divider label="or a Solana wallet" />
                  <SignUp.SolanaWallets />
                </SignUp>
              )}
            />
          </>
        )}
      </main>
    </div>
  )
}
