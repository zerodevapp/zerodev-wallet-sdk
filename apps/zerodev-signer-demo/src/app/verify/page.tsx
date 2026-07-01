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
    <div className="mx-auto w-full max-w-[500px] flex flex-col flex-1 px-4 py-6 sm:max-w-none sm:flex-row sm:items-start sm:justify-center sm:px-6 sm:py-10">
      <div className="w-full flex flex-col sm:w-[430px] sm:h-[688px] sm:overflow-hidden">
        <div className="w-full flex flex-col sm:w-[500px] sm:h-[800px] sm:origin-top sm:scale-[0.86]">
          <AuthFlow />
        </div>
      </div>
    </div>
  )
}
