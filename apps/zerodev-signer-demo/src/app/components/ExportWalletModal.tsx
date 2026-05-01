'use client'

import { useExportWallet } from '@zerodev/wallet-react'
import { AlertTriangle, Download, Loader2, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../lib/utils'

type ExportWalletModalProps = {
  isOpen: boolean
  onClose: () => void
}

const iframeContainerId = 'export-wallet-iframe-container'
export function ExportWalletModal({ isOpen, onClose }: ExportWalletModalProps) {
  const [showWarning, setShowWarning] = useState(true)
  const [exporting, setExporting] = useState(false)

  const exportWallet = useExportWallet()

  const handleExport = async () => {
    setShowWarning(false)
    setExporting(true)

    // Wait for iframe container to be in DOM
    await new Promise((resolve) => setTimeout(resolve, 100))

    try {
      await exportWallet.mutateAsync({
        iframeContainerId,
        iframeStyles: {
          backgroundColor: '#ffffff',
          color: '#1a1a1a',
          fontSize: '14px',
          fontFamily: 'monospace',
          padding: '16px',
          borderRadius: '8px',
          width: '100%',
        },
      })
      // Iframe will show the seed phrase
    } catch (err) {
      console.error('Export error:', err)
      setShowWarning(true)
      setExporting(false)
    }
  }

  const handleClose = () => {
    setShowWarning(true)
    setExporting(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">
              Export Wallet
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-4">
          {/* Warning */}
          {showWarning && !exporting && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900 mb-2">
                  Security Warning
                </p>
                <ul className="text-sm text-red-700 space-y-1.5">
                  <li>• Never share your seed phrase with anyone</li>
                  <li>
                    • Store it in a secure location (password manager, offline)
                  </li>
                  <li>• Anyone with your seed phrase can access your funds</li>
                  <li>• Make sure no one is watching your screen</li>
                </ul>
              </div>
            </div>
          )}

          {/* Export Button or Iframe Container */}
          {!exporting ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Export your wallet&apos;s seed phrase to import it into other
                wallets or backup.
              </p>

              <button
                onClick={handleExport}
                disabled={exportWallet.isPending}
                style={{
                  background:
                    'linear-gradient(white, white) padding-box, linear-gradient(to right, #22d3ee, #2563eb) border-box',
                }}
                className={cn(
                  'w-full py-3 px-4 rounded-lg font-semibold text-sm cursor-pointer',
                  'border-2 border-transparent text-blue-500',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'flex items-center justify-center gap-2',
                )}
              >
                {exportWallet.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Export Seed Phrase
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 font-medium mb-2">
                  Your Seed Phrase
                </p>
                <p className="text-xs text-blue-500">
                  Write this down and store it safely. You&apos;ll need it to
                  recover your wallet.
                </p>
              </div>

              {/* Iframe Container - This will show the seed phrase */}
              <div
                id={iframeContainerId}
                className="border border-gray-200 rounded-lg bg-white overflow-hidden [&>iframe]:w-full [&>iframe]:min-h-[200px] [&>iframe]:border-none [&>iframe]:block"
              >
                {/* Turnkey iframe will inject content here */}
              </div>

              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <p className="text-xs text-yellow-700">
                  Make sure to save this seed phrase before closing this window
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {exportWallet.error && (
            <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">
                  Export Failed
                </p>
                <p className="text-sm text-red-700 mt-0.5">
                  {exportWallet.error.message}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            className="w-full py-2.5 px-4 rounded-lg font-medium text-sm border border-gray-200 bg-white text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
