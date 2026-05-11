'use client'

import { AuthFlow } from '@zerodev/wallet-react-kit'
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

  useEffect(() => {
    if (isConnected) {
      router.push('/dashboard')
    }
  }, [isConnected, router])

  return (
    <div className="mx-auto h-screen w-[500px]">
      <AuthFlow />
    </div>
  )
}
