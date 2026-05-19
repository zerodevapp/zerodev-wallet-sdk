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
    <div className="mx-auto w-full max-w-[500px] min-h-screen flex flex-col sm:max-w-none sm:h-screen sm:min-h-0 sm:flex-row sm:items-center sm:justify-center">
      <div className="flex-1 w-full flex flex-col sm:flex-none sm:w-[500px] sm:h-[800px]">
        <AuthFlow />
      </div>
    </div>
  )
}
