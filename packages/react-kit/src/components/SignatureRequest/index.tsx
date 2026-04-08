'use client'

import { usePendingRequest } from '../../hooks/usePendingRequest.js'
import { cn } from '../../shared/utils/common.js'

// todo: proper UI
export function SignatureRequest() {
  const { pendingRequest, confirm, reject } = usePendingRequest()

  if (!pendingRequest) return null

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 mt-4 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Confirm Request
      </h3>

      <div className="text-sm mb-2">
        <span className="font-medium text-gray-500">Method: </span>
        <span className="text-gray-900">{pendingRequest.method}</span>
      </div>

      <pre className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-700 overflow-auto max-h-48 border border-gray-100">
        {JSON.stringify(pendingRequest.params, null, 2)}
      </pre>

      <div className="flex gap-3 mt-4">
        <button
          type="button"
          onClick={reject}
          className={cn(
            'flex-1 rounded-lg border border-gray-300 px-4 py-2.5',
            'text-sm font-medium text-gray-700',
            'hover:bg-gray-50 transition-colors cursor-pointer',
          )}
        >
          Reject
        </button>
        <button
          type="button"
          onClick={confirm}
          className={cn(
            'flex-1 rounded-lg bg-gray-900 px-4 py-2.5',
            'text-sm font-medium text-white',
            'hover:bg-gray-800 transition-colors cursor-pointer',
          )}
        >
          Confirm
        </button>
      </div>
    </div>
  )
}
