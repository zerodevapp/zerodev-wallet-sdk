import type { Hex } from 'viem'
import { SigningActions } from '../components/SigningActions'
import { type DecodedTypedData, decodeTypedData } from '../utils/typedData.js'

interface SignTypedDataProps {
  address: Hex
  typedData: string
  confirm: () => void
  reject: () => void
}

function renderFields(fields: Record<string, unknown>) {
  return Object.entries(fields).map(([key, value]) => (
    <div key={key} className="mt-1 text-sm text-gray-500">
      <span className="font-medium">{key}: </span>
      <span className="font-mono break-all">
        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
      </span>
    </div>
  ))
}

function DecodedView({
  decoded,
  address,
}: {
  decoded: DecodedTypedData
  address: Hex
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-gray-900">
        Sign {decoded.primaryType}
      </h3>

      <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
        {renderFields(decoded.message)}
        <div className="mt-2 text-sm text-gray-500">
          <span className="font-medium">Signer: </span>
          <span className="font-mono break-all">{address}</span>
        </div>
      </div>

      {Object.keys(decoded.domain).length > 0 && (
        <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
          <p className="text-sm font-medium text-gray-700">Domain</p>
          {renderFields(decoded.domain)}
        </div>
      )}
    </div>
  )
}

export function SignTypedData({
  address,
  typedData,
  confirm,
  reject,
}: SignTypedDataProps) {
  const decoded = decodeTypedData(typedData)

  if (!decoded) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-gray-900">Sign Typed Data</h3>
        <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Raw data:</p>
          <pre className="text-sm text-gray-900 whitespace-pre-wrap break-all">
            {typedData}
          </pre>
        </div>
        <SigningActions onConfirm={confirm} onReject={reject} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <DecodedView decoded={decoded} address={address} />
      <SigningActions onConfirm={confirm} onReject={reject} />
    </div>
  )
}
