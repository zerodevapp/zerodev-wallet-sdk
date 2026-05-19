'use client'

import {AuthFlow} from '@zerodev/wallet-react-kit'
import {Settings} from 'lucide-react'
import {useRouter, useSearchParams} from 'next/navigation'
import {Suspense, useEffect, useState} from 'react'
import {useAccount, useConnect} from 'wagmi'

export const dynamic = 'force-dynamic'

type EmailAuthMethod = 'otp' | 'magicLink'

export default function LandingPage() {
  return (
    <Suspense>
      <LandingPageInner/>
    </Suspense>
  )
}

function LandingPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionExpired = searchParams.get('session_expired') === 'true'

  const {connect, connectors, status: connectStatus} = useConnect()
  const {isConnected, status: accountStatus} = useAccount()

  useEffect(() => {
    if (isConnected) {
      router.push('/dashboard')
      return
    }
    if (
      accountStatus === 'disconnected' &&
      connectStatus === 'idle' &&
      connectors[0]
    ) {
      connect({connector: connectors[0]})
    }
  }, [isConnected, accountStatus, connectStatus, router, connect, connectors])

  return (
    <div
      className="mx-auto w-full max-w-[500px] min-h-screen flex flex-col sm:max-w-none sm:h-screen sm:min-h-0 sm:flex-row sm:items-center sm:justify-center">
      {sessionExpired && (
        <div
          className="m-4 px-4 py-3 rounded-lg text-sm text-center bg-yellow-50 text-yellow-700 border border-yellow-200">
          Your session has expired. Please log in again.
        </div>
      )}
      <div className="flex-1 w-full flex flex-col sm:flex-none sm:w-[500px] sm:h-[800px]">
        <EmailMethodSettings/>
        <AuthFlow/>
      </div>
    </div>
  )
}

function EmailMethodSettings() {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<EmailAuthMethod>(() => {
    if (typeof window === 'undefined') return 'otp'
    return localStorage.getItem('zd:emailAuthMethod') === 'magicLink'
      ? 'magicLink'
      : 'otp'
  })

  const handleSave = (next: EmailAuthMethod) => {
    localStorage.setItem('zd:emailAuthMethod', next)
    window.location.reload()
  }

  const handleOpen = () => {
    // Re-sync from storage on open so a previous Cancel doesn't leave the
    // radios pointing at an unsaved selection.
    setMethod(
      localStorage.getItem('zd:emailAuthMethod') === 'magicLink'
        ? 'magicLink'
        : 'otp',
    )
    setOpen(true)
  }

  return (
    <div className="flex justify-end pb-2">
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Email method settings"
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
      >
        <Settings className="h-6 w-6"/>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-lg p-6 w-[320px] flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-gray-900">
              Email auth method
            </h2>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="emailAuthMethod"
                value="otp"
                checked={method === 'otp'}
                onChange={() => setMethod('otp')}
              />
              <span className="text-gray-700">OTP code</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="emailAuthMethod"
                value="magicLink"
                checked={method === 'magicLink'}
                onChange={() => setMethod('magicLink')}
              />
              <span className="text-gray-700">Magic link</span>
            </label>
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSave(method)}
                className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 cursor-pointer"
              >
                Save and reload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
