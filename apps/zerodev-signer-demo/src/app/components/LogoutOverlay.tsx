'use client'

import { Loader2 } from 'lucide-react'

export function LogoutOverlay({ visible }: { visible: boolean }) {
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="flex flex-col items-center gap-3 animate-[auth-transition-card_450ms_ease-out_forwards]">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500"/>
        <p className="text-sm font-medium text-gray-500">Logging out...</p>
      </div>
    </div>
  )
}
