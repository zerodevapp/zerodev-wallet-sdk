/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, LogOut, Wallet } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useAccount, useDisconnect } from 'wagmi'
import { ChainSelector } from './ChainSelector'
import { LogoutOverlay } from './LogoutOverlay'

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
      <LogoutOverlay visible={loggingOut}/>
      <header className="sticky top-0 z-40 border-b border-white/50 bg-white/55 backdrop-blur-xl supports-[backdrop-filter]:bg-white/45">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5">
                <img src="/images/zerodev-logo.png" alt="ZeroDev Logo" className="h-10 w-10" />
                <span className="text-2xl font-semibold leading-none tracking-tight text-gray-900">
                  ZeroDev
                </span>
              </div>
              <span className="text-sm px-3 py-1.5 bg-blue-50 text-blue-500 rounded-full font-medium border border-blue-100">
                Wallet Demo
              </span>
            </div>

            <div className="flex items-center gap-3">
              <nav
                aria-label="Primary navigation"
                className="hidden items-center gap-6 md:flex"
              >
                <a
                  href="https://docs.zerodev.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-950"
                >
                  Documentation
                </a>
                <a
                  href="https://dashboard.zerodev.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-950"
                >
                  Get your API keys
                </a>
                <a
                  href="https://zerodev.app/book-a-demo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center rounded-full bg-gray-950 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-800"
                >
                  Contact sales
                </a>
              </nav>
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
