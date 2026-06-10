/* eslint-disable @next/next/no-img-element */
'use client'

import { useAuth } from '@zerodev/wallet-react-kit'
import { Check, Copy, LogOut, Settings, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useDisconnect } from 'wagmi'
import { ChainSelector } from './ChainSelector'

type EmailAuthMethod = 'otp' | 'magicLink'

export function Navbar() {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { disconnectAsync } = useDisconnect()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLogout = async () => {
    localStorage.setItem('zd:loggedOut', 'true')
    await disconnectAsync()
    router.push('/')
  }

  const formatAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`

  return (
    <header className="bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center gap-3">
            <img src="/images/zerodev-logo.png" alt="ZeroDev Logo" className="w-10 h-10" />
            <div className="flex flex-col">
              <span className="text-xl font-semibold text-gray-900 leading-tight">ZeroDev</span>
              <span className="text-xs text-gray-500">By Offchain Labs</span>
            </div>
            <span className="text-sm px-3 py-1.5 bg-blue-50 text-blue-500 rounded-full font-medium border border-blue-100">
              Wallet Demo
            </span>
          </div>

          <div className="flex items-center gap-3">
            {!isConnected && <EmailMethodSettings />}
            {isConnected && address && (
              <>
                <ChainSelector />
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200 group cursor-pointer">
                  <Wallet className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-mono text-gray-700">{formatAddress(address)}</span>
                  <button
                    onClick={handleCopy}
                    className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function EmailMethodSettings() {
  const {step} = useAuth()
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

  if (step === null || step === 'authenticated') return null

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Email method settings"
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
      >
        <Settings className="h-5 w-5" />
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
    </>
  )
}
