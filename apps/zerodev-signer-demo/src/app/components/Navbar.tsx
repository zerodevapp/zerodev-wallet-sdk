/* eslint-disable @next/next/no-img-element */
'use client'

import { Check, Copy, Loader2, LogOut, Wallet } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { ChainSelector } from './ChainSelector'

export function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { address, isConnected } = useAccount()
  const { disconnectAsync } = useDisconnect()
  const [copied, setCopied] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    if (pathname === '/') {
      setLoggingOut(false)
    }
  }, [pathname])

  const handleCopy = async () => {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    localStorage.setItem('zd:loggedOut', 'true')
    try {
      await disconnectAsync()
    } catch {
      setLoggingOut(false)
      return
    }
    router.push('/?logged_out=true')
  }

  const formatAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`

  return (
    <>
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-300 ${
          loggingOut
            ? 'opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="flex flex-col items-center gap-3 animate-[auth-transition-card_450ms_ease-out_forwards]">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500"/>
          <p className="text-sm font-medium text-gray-500">
            Logging out...
          </p>
        </div>
      </div>
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
                  disabled={loggingOut}
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
    </>
  )
}
