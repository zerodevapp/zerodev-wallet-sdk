import type { Request } from '../../types.js'
import { SigningLayout } from '../components/SigningLayout'

interface GenericRequestProps {
  request: Request
  confirm: () => void
  reject: () => void
}

export function GenericRequest({
  request,
  confirm,
  reject,
}: GenericRequestProps) {
  return (
    <SigningLayout onConfirm={confirm} onReject={reject}>
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
    </SigningLayout>
  )
}
