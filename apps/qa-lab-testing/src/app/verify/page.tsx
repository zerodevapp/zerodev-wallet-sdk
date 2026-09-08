'use client'

import { ConnectWallet, useAuth } from '@zerodev/wallet-react-ui'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'

export const dynamic = 'force-dynamic'

/**
 * How long to wait for the persisted OTP session before mounting anyway. Only
 * reached when there is nothing to restore — someone opening /verify cold — where
 * `ConnectWallet` should render its own "Invalid Link" state rather than spin
 * forever.
 */
const HYDRATION_GRACE_MS = 3_000

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyPageInner />
    </Suspense>
  )
}

function VerifyPageInner() {
  const router = useRouter()
  const { isConnected } = useAccount()
  const { otpId, step, reset } = useAuth()

  // "Choose another sign-in method" on the error screens moves the step to
  // 'sign-up' — nothing else does on /verify (reconnect rethrows without
  // touching the step). Hand the flow back to the home login screen instead
  // of restarting sign-up inside /verify: reset first so LoginScreen's
  // auto-connect reopens the widget through the normal connect path.
  useEffect(() => {
    if (step === 'sign-up') {
      reset()
      router.push('/')
    }
  }, [step, reset, router])

  /**
   * Don't mount `ConnectWallet` until the OTP session has been restored.
   *
   * It reads the magic-link code on its first render and, finding no `otpId`,
   * strips the code and drops to a null step — which renders nothing, with no
   * error. It never retries: `Verifying` marks its single attempt as spent
   * before checking whether the session was there.
   *
   * The session is restored by the connector's `setup()`, which this app starts
   * later than the signer demo does — the demo builds its wagmi config at module
   * scope, this one builds it per-render from URL params. That is the race, and
   * why the same `/verify` works there and not here.
   */
  const [graceElapsed, setGraceElapsed] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setGraceElapsed(true), HYDRATION_GRACE_MS)
    return () => clearTimeout(timer)
  }, [])
  const sessionSettled = otpId !== null || graceElapsed

  useEffect(() => {
    if (isConnected) {
      router.push('/')
    }
  }, [isConnected, router])

  return (
    <div className="mx-auto w-full max-w-[500px] min-h-screen flex flex-col sm:max-w-none sm:h-screen sm:min-h-0 sm:flex-row sm:items-center sm:justify-center">
      <div className="flex-1 w-full flex flex-col items-center justify-center sm:flex-none sm:w-[500px] sm:h-[800px]">
        {sessionSettled ? (
          <ConnectWallet size="md" />
        ) : (
          <Loader2
            className="h-10 w-10 animate-spin text-[var(--muted)]"
            data-testid="verify-restoring-session"
          />
        )}
      </div>
    </div>
  )
}
