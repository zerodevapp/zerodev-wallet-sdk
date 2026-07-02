import { Text } from '@zerodev/react-ui'
import {
  type Address,
  formatEther,
  type Hex,
  hexToBigInt,
  toHex,
  zeroAddress,
} from 'viem'
import { shortenHex } from '../../shared/utils/common'
import type { Request } from '../../types.js'
import { DataRow, DataRowSkeleton } from '../components/DataRow'
import { Section } from '../components/Section'
import { SigningLayout } from '../components/SigningLayout'
import { useGasEstimate } from '../hooks/useGasEstimate'
import { formatGasFee } from '../utils/formatGasFee'

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
  if (
    request.method !== 'eth_sendTransaction' &&
    request.method !== 'wallet_sendTransaction'
  ) {
    return (
      <SigningLayout onConfirm={confirm} onReject={reject}>
        <div className="zd:flex zd:flex-col zd:gap-2 zd:pt-4">
          <div className="zd:flex zd:flex-col zd:items-center zd:justify-center zd:gap-2 zd:pb-2">
            <Text className="zd:text-h2">Confirm Request</Text>
          </div>
          <div className="zd:text-sm">
            <span className="zd:font-medium zd:text-gray-500">Method: </span>
            <span className="zd:text-gray-900">{request.method}</span>
          </div>
          <pre className="zd:rounded-lg zd:bg-gray-50 zd:p-3 zd:text-xs zd:text-gray-700 zd:overflow-auto zd:max-h-48 zd:border zd:border-gray-100">
            {JSON.stringify(request.params, null, 2)}
          </pre>
        </div>
      </SigningLayout>
    )
  }

  return (
    <GenericSendTransaction
      params={request.params}
      confirm={confirm}
      reject={reject}
    />
  )
}

function GenericSendTransaction({
  params,
  confirm,
  reject,
}: {
  params: Extract<
    Request,
    { method: 'eth_sendTransaction' | 'wallet_sendTransaction' }
  >['params']
  confirm: () => void
  reject: () => void
}) {
  const [{ data = '0x', to, value = toHex(0) }] = params

  const {
    data: gasEstimate,
    isFetching: gasFetching,
    error: gasError,
  } = useGasEstimate({
    calls: [
      {
        to: (to ?? zeroAddress) as Address,
        value: value as Hex,
        data: data as Hex,
      },
    ],
  })

  const confirmDisabled = gasFetching || gasEstimate == null

  return (
    <SigningLayout
      onConfirm={confirm}
      onReject={reject}
      disabled={confirmDisabled}
      error={gasError}
    >
      <div className="zd:flex zd:flex-col zd:gap-2 zd:pt-4">
        <div className="zd:flex zd:flex-col zd:items-center zd:justify-center zd:gap-2 zd:pb-2">
          <Text className="zd:text-h2">Confirm Transaction</Text>
        </div>
        <Section title="Transaction Summary" iconName="arrowSwapHorizontal">
          <DataRow label="To" value={shortenHex((to ?? '0x') as string)} />
          <DataRow
            label="Value"
            value={`${formatEther(hexToBigInt(value as Hex))} ETH`}
          />
          <DataRow label="Data" value={shortenHex(data as Hex)} />
        </Section>
        {!gasError && (
          <Section title="Estimated Gas Fee" iconName="lightingFill">
            {gasEstimate != null ? (
              <DataRow
                label="Fee"
                value={formatGasFee(gasEstimate)}
                iconName="gasStation"
              />
            ) : (
              <DataRowSkeleton label="Fee" />
            )}
          </Section>
        )}
      </div>
    </SigningLayout>
  )
}
