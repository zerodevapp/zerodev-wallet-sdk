'use client'

import type { Address, Hex } from 'viem'
import { usePendingRequest } from './hooks/usePendingRequest.js'
import { Erc20Transfer } from './pages/Erc20Transfer.js'
import { EthTransfer } from './pages/EthTransfer.js'
import { GenericRequest } from './pages/GenericRequest.js'
import { decodeErc20Transfer, isErc20Transfer } from './utils/erc20Transfer.js'
import { isEthTransfer } from './utils/ethTransfer.js'

export function SignatureRequest() {
  const { pendingRequest, pendingRequests, confirm, reject } =
    usePendingRequest()

  if (!pendingRequest) return null

  function renderContent() {
    switch (pendingRequest.method) {
      case 'eth_sendTransaction':
      case 'wallet_sendTransaction': {
        const tx = pendingRequest.params[0]

        if (isEthTransfer(tx)) {
          return (
            <EthTransfer
              to={tx.to as Address}
              value={tx.value as Hex}
              confirm={confirm}
              reject={reject}
            />
          )
        }

        if (isErc20Transfer(tx)) {
          const decoded = decodeErc20Transfer(tx)
          if (decoded) {
            return (
              <Erc20Transfer
                contract={tx.to as Address}
                to={decoded.to}
                amount={decoded.amount}
                confirm={confirm}
                reject={reject}
              />
            )
          }
        }
      }
    }

    return (
      <GenericRequest
        request={pendingRequest}
        confirm={confirm}
        reject={reject}
      />
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 mt-4 shadow-sm">
      {renderContent()}

      {pendingRequests.length > 1 && (
        <p className="text-xs text-gray-500 mt-3">
          +{pendingRequests.length - 1} more pending{' '}
          {pendingRequests.length - 1 === 1 ? 'request' : 'requests'}
        </p>
      )}
    </div>
  )
}
