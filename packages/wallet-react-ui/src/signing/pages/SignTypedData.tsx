import { DataRow, Text } from '@zerodev/react-ui'
import type { Hex } from 'viem'
import { shortenHex } from '../../shared/utils/common'
import { Section } from '../components/Section'
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
        <div className="zd:flex zd:flex-col zd:gap-3">
          <h3 className="zd:text-lg zd:font-semibold zd:text-gray-900">
            Sign Typed Data
          </h3>
          <div className="zd:rounded-lg zd:bg-gray-50 zd:p-4 zd:border zd:border-gray-100">
            <p className="zd:text-xs zd:text-gray-500 zd:mb-1">Raw data:</p>
            <pre className="zd:text-sm zd:text-gray-900 zd:whitespace-pre-wrap zd:break-all">
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
      <div className="zd:flex zd:flex-col zd:gap-2 zd:pt-4">
        <div className="zd:flex zd:flex-col zd:items-center zd:justify-center zd:gap-2 zd:pb-2">
          <Text className="zd:text-h2">Signature Request</Text>
          <Text className="zd:text-center">
            Review request details before you confirm.
          </Text>
        </div>
        {hasDomain && (
          <Section title="Domain" iconName="info">
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
          </Section>
        )}
        <Section title="Message" iconName="message">
          <TypedDataMessage
            message={message}
            primaryType={primaryType}
            types={types}
          />
        </Section>
      </div>
    </SigningLayout>
  )
}
