'use client'

import { AuthFlow } from '@zerodev/wallet-react-kit'
import { useRouter } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'

export const dynamic = 'force-dynamic'

export default function VerifyPage() {
  // SSR gate: useAccount throws if Next's prerender pass evaluates this page
  // without a WagmiProvider in context. Defer until mount.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  if (!mounted) return null
  return (
    <Suspense>
      <VerifyPageInner />
    </Suspense>
  )
}

function VerifyPageInner() {
  const router = useRouter()
  const { isConnected } = useAccount()

  useEffect(() => {
    if (isConnected) {
      router.push('/dashboard')
    }
  }, [isConnected, router])

  return (
    <div className="mx-auto h-[800px] w-[500px]">
      <AuthFlow />
    </div>
  )
}
