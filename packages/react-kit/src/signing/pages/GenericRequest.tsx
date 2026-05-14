import {
  type Address,
  formatEther,
  type Hex,
  hexToBigInt,
  toHex,
  zeroAddress,
} from 'viem'

import { Text } from '../../shared/components/Text'
import { shortenHex } from '../../shared/utils/common'
import type { Request } from '../../types.js'
import { DataRow, DataRowSkeleton } from '../components/DataRow'
import { DetailsContainer } from '../components/DetailsContainer'
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
        <div className="flex flex-col gap-2 pt-4">
          <div className="flex flex-col items-center justify-center gap-2 pb-2">
            <Text className="text-h2">Confirm Request</Text>
          </div>
          <div className="text-sm">
            <span className="font-medium text-gray-500">Method: </span>
            <span className="text-gray-900">{request.method}</span>
          </div>
          <pre className="rounded-lg bg-gray-50 p-3 text-xs text-gray-700 overflow-auto max-h-48 border border-gray-100">
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
    isError: gasError,
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
    >
      <div className="flex flex-col gap-2 pt-4">
        <div className="flex flex-col items-center justify-center gap-2 pb-2">
          <Text className="text-h2">Confirm Transaction</Text>
        </div>
        <DetailsContainer
          title="Transaction Summary"
          iconName="arrowSwapHorizontal"
        >
          <DataRow label="To" value={shortenHex((to ?? '0x') as string)} />
          <DataRow
            label="Value"
            value={`${formatEther(hexToBigInt(value as Hex))} ETH`}
          />
          <DataRow label="Data" value={shortenHex(data as Hex)} />
        </DetailsContainer>
        <DetailsContainer title="Estimated Gas Fee" iconName="lightingFill">
          {gasError ? (
            <DataRow label="Fee" value="Error" iconName="gasStation" />
          ) : gasEstimate != null ? (
            <DataRow
              label="Fee"
              value={formatGasFee(gasEstimate)}
              iconName="gasStation"
            />
          ) : (
            <DataRowSkeleton label="Fee" />
          )}
        </DetailsContainer>
      </div>
    </SigningLayout>
  )
}
