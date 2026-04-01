import { Button, CodeInput } from '@zerodev/wallet-react-kit'
import { useState } from 'react'

export function App() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            ZeroDev React Kit — React Example
          </h1>
          <p className="mt-2 text-gray-500">
            Interactive demo of{' '}
            <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
              @zerodev/wallet-react-kit
            </code>{' '}
            components
          </p>
        </div>
        <Button
          text="Connect Wallet"
          onClick={() => {
            alert('Button clicked!')
          }}
        />
      </div>
    </div>
  )
}
