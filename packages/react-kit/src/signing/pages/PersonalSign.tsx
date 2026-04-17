import type { Hex } from 'viem'
import { SigningActions } from '../components/SigningActions.js'
import { decodePersonalSignMessage } from '../utils/personalSign.js'

interface PersonalSignProps {
  data: Hex
  address: Hex
  confirm: () => void
  reject: () => void
}

export function PersonalSign({
  data,
  address,
  confirm,
  reject,
}: PersonalSignProps) {
  const message = decodePersonalSignMessage(data)

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-gray-900">Sign Message</h3>

      <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
        <pre className="text-sm text-gray-900 whitespace-pre-wrap break-all">
          {message}
        </pre>
        <div className="mt-2 text-sm text-gray-500">
          <span className="font-medium">Signer: </span>
          <span className="font-mono break-all">{address}</span>
        </div>
      </div>

      <SigningActions confirm={confirm} reject={reject} />
    </div>
  )
}
