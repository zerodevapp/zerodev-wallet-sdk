import type { Hex } from 'viem'

import { Text } from '../../shared/components/Text'
import { shortenHex } from '../../shared/utils/common'
import { DataRow } from '../components/DataRow'
import { DetailsContainer } from '../components/DetailsContainer'
import { SigningLayout } from '../components/SigningLayout'
import { TypedDataMessage } from '../components/TypedDataMessage'
import { decodeTypedData } from '../utils/typedData.js'

interface SignTypedDataProps {
  address: Hex
  typedData: string
  confirm: () => void
  reject: () => void
}

export function SignTypedData({
  typedData,
  confirm,
  reject,
}: SignTypedDataProps) {
  const decoded = decodeTypedData(typedData)

  if (!decoded) {
    return (
      <SigningLayout onConfirm={confirm} onReject={reject}>
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold text-gray-900">
            Sign Typed Data
          </h3>
          <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Raw data:</p>
            <pre className="text-sm text-gray-900 whitespace-pre-wrap break-all">
              {typedData}
            </pre>
          </div>
        </div>
      </SigningLayout>
    )
  }

  const { domain, message, primaryType, types } = decoded
  const name = domain.name as string | undefined
  const version = domain.version as string | undefined
  const chainId = domain.chainId as number | string | undefined
  const verifyingContract = domain.verifyingContract as string | undefined
  const hasDomain = Object.keys(domain).length > 0

  return (
    <SigningLayout onConfirm={confirm} onReject={reject}>
      <div className="flex flex-col gap-2 pt-4">
        <div className="flex flex-col items-center justify-center gap-2 pb-2">
          <Text className="text-h2">Signature Request</Text>
          <Text className="text-center">
            Review request details before you confirm.
          </Text>
        </div>
        {hasDomain && (
          <DetailsContainer title="Domain" iconName="info">
            <DataRow label="Name" value={name} />
            <DataRow label="Version" value={version} />
            <DataRow
              label="Network"
              value={chainId !== undefined ? String(chainId) : undefined}
            />
            <DataRow
              label="Contract"
              value={
                verifyingContract ? shortenHex(verifyingContract) : undefined
              }
            />
          </DetailsContainer>
        )}
        <DetailsContainer title="Message" iconName="message">
          <TypedDataMessage
            message={message}
            primaryType={primaryType}
            types={types}
          />
        </DetailsContainer>
      </div>
    </SigningLayout>
  )
}
