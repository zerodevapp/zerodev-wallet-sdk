import type { PendingRequest } from '../../types.js'
import { SigningActions } from '../components/SigningActions'

interface GenericRequestProps {
  request: PendingRequest
  confirm: () => void
  reject: () => void
}

export function GenericRequest({
  request,
  confirm,
  reject,
}: GenericRequestProps) {
  return (
    <>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Confirm Request
      </h3>

      <div className="text-sm mb-2">
        <span className="font-medium text-gray-500">Method: </span>
        <span className="text-gray-900">{request.method}</span>
      </div>

      <pre className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-700 overflow-auto max-h-48 border border-gray-100">
        {JSON.stringify(request.params, null, 2)}
      </pre>

      <div className="mt-4">
        <SigningActions confirm={confirm} reject={reject} />
      </div>
    </>
  )
}
