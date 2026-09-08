'use client'

import { ConnectWallet, useAuth } from '@zerodev/wallet-react-ui'
import { useRouter } from 'next/navigation'
import { Suspense, useEffect } from 'react'
import { useAccount } from 'wagmi'

export const dynamic = 'force-dynamic'

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
  const { step, reset } = useAuth()

  useEffect(() => {
    if (isConnected) {
      router.push('/dashboard')
    }
  }, [isConnected, router])

  // "Choose another sign-in method" on the verify error screens moves the
  // step to 'sign-up' — nothing else does on /verify (reconnect rethrows
  // without touching the step). Hand the flow back to the home login screen
  // instead of restarting sign-up inside /verify: reset first so the home
  // page's auto-connect reopens the widget through the normal connect path.
  useEffect(() => {
    if (step === 'sign-up') {
      reset()
      router.push('/')
    }
  }, [step, reset, router])

  return (
    <div className="mx-auto w-full max-w-[500px] min-h-screen flex flex-col sm:max-w-none sm:h-screen sm:min-h-0 sm:flex-row sm:items-center sm:justify-center">
      <div className="flex-1 w-full flex flex-col sm:flex-none sm:w-[500px] sm:h-[800px]">
        <ConnectWallet size="md" />
      </div>
    </div>
  )
}
