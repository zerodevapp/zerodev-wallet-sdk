import { useMemo } from 'react'
import {
  type Address,
  erc20Abi,
  formatEther,
  formatUnits,
  type Hex,
  maxUint256,
  zeroAddress,
} from 'viem'
import { useReadContracts } from 'wagmi'

import { Text } from '../../shared/components/Text'
import { shortenHex } from '../../shared/utils/common'
import type { BatchCall } from '../../types.js'
import { DataRow, DataRowSkeleton } from '../components/DataRow'
import { DetailsContainer } from '../components/DetailsContainer'
import { SigningLayout } from '../components/SigningLayout'
import { SigningPageSkeleton } from '../components/SigningPageSkeleton'
import { TxDetailsItem } from '../components/TxDetailsItem'
import { useGasEstimate } from '../hooks/useGasEstimate'
import {
  decodeCollectionApproval,
  isCollectionApproval,
} from '../utils/collectionApproval.js'
import { decodeErc20Approval, isErc20Approval } from '../utils/erc20Approval.js'
import { decodeErc20Transfer, isErc20Transfer } from '../utils/erc20Transfer.js'
import { isEthTransfer } from '../utils/ethTransfer.js'
import { formatGasFee } from '../utils/formatGasFee'

const EXECUTION_TIME = '≈ 1 sec'

type TokenInfo = {
  symbol?: string | undefined
  decimals?: number | undefined
}

type TokenInfoMap = Map<Address, TokenInfo>

interface BatchCallsProps {
  calls: BatchCall[]
  confirm: () => void
  reject: () => void
}

function EthTransferItem({
  to,
  value,
  index,
}: {
  to: Address
  value: Hex
  index: number
}) {
  return (
    <TxDetailsItem
      title="Send ETH"
      index={index}
      data={{
        To: shortenHex(to),
        Amount: `${formatEther(BigInt(value))} ETH`,
      }}
    />
  )
}

function Erc20TransferItem({
  to,
  amount,
  index,
  tokenInfo,
}: {
  to: Address
  amount: bigint
  index: number
  tokenInfo: TokenInfo
}) {
  const { symbol, decimals } = tokenInfo
  const formatted =
    decimals != null ? formatUnits(amount, decimals) : String(amount)
  const symbolStr = symbol ?? ''

  return (
    <TxDetailsItem
      title={`Send ${symbol ?? 'ERC-20'}`}
      index={index}
      data={{
        To: shortenHex(to),
        Amount: `${formatted} ${symbolStr}`.trim(),
      }}
    />
  )
}

function Erc20ApprovalItem({
  spender,
  amount,
  index,
  tokenInfo,
}: {
  spender: Address
  amount: bigint
  index: number
  tokenInfo: TokenInfo
}) {
  const { symbol, decimals } = tokenInfo
  const isUnlimited = amount === maxUint256
  const allowance = isUnlimited
    ? 'Unlimited'
    : decimals != null
      ? `${formatUnits(amount, decimals)} ${symbol ?? ''}`.trim()
      : String(amount)

  return (
    <TxDetailsItem
      title="Approval"
      index={index}
      data={{
        Spender: shortenHex(spender),
        Allowance: allowance,
      }}
    />
  )
}

function CollectionApprovalItem({
  contract,
  operator,
  approved,
  index,
}: {
  contract: Address
  operator: Address
  approved: boolean
  index: number
}) {
  return (
    <TxDetailsItem
      title="Collection Approval"
      index={index}
      data={{
        Contract: shortenHex(contract),
        Operator: shortenHex(operator),
        Approved: approved ? 'Yes' : 'No',
      }}
    />
  )
}

function UnknownCallItem({ call, index }: { call: BatchCall; index: number }) {
  const data: Record<string, string> = {}
  if (call.to) data.To = shortenHex(call.to)
  if (call.value && BigInt(call.value) > 0n) {
    data.Value = `${formatEther(BigInt(call.value))} ETH`
  }
  if (call.data) data.Data = call.data

  return <TxDetailsItem title="Unknown Message" index={index} data={data} />
}

function CallItem({
  call,
  index,
  tokenInfoMap,
}: {
  call: BatchCall
  index: number
  tokenInfoMap: TokenInfoMap
}) {
  const tx = call as Parameters<typeof isEthTransfer>[0]

  if (isEthTransfer(tx)) {
    return (
      <EthTransferItem
        to={call.to as Address}
        value={call.value as Hex}
        index={index}
      />
    )
  }

  if (isErc20Transfer(tx)) {
    const decoded = decodeErc20Transfer(tx)
    if (decoded) {
      const contract = call.to as Address
      return (
        <Erc20TransferItem
          to={decoded.to}
          amount={decoded.amount}
          index={index}
          tokenInfo={tokenInfoMap.get(contract) ?? {}}
        />
      )
    }
  }

  if (isErc20Approval(tx)) {
    const decoded = decodeErc20Approval(tx)
    if (decoded) {
      const contract = call.to as Address
      return (
        <Erc20ApprovalItem
          spender={decoded.spender}
          amount={decoded.amount}
          index={index}
          tokenInfo={tokenInfoMap.get(contract) ?? {}}
        />
      )
    }
  }

  if (isCollectionApproval(tx)) {
    const decoded = decodeCollectionApproval(tx)
    if (decoded) {
      return (
        <CollectionApprovalItem
          contract={call.to as Address}
          operator={decoded.operator}
          approved={decoded.approved}
          index={index}
        />
      )
    }
  }

  return <UnknownCallItem call={call} index={index} />
}

function getErc20Addresses(calls: BatchCall[]): Address[] {
  const addresses = new Set<Address>()
  for (const call of calls) {
    if (!call.to) continue
    const tx = call as Parameters<typeof isEthTransfer>[0]
    if (isErc20Transfer(tx) || isErc20Approval(tx)) {
      addresses.add(call.to as Address)
    }
  }
  return [...addresses]
}

export function BatchCalls({ calls, confirm, reject }: BatchCallsProps) {
  const erc20Addresses = useMemo(() => getErc20Addresses(calls), [calls])

  const erc20Reads = useMemo(
    () =>
      erc20Addresses.flatMap((address) => [
        {
          address,
          abi: erc20Abi,
          functionName: 'symbol' as const,
        },
        {
          address,
          abi: erc20Abi,
          functionName: 'decimals' as const,
        },
      ]),
    [erc20Addresses],
  )

  const { data: tokenResults, isLoading: tokensLoading } = useReadContracts({
    contracts: erc20Reads,
    query: { enabled: erc20Reads.length > 0 },
  })

  const tokenInfoMap = useMemo<TokenInfoMap>(() => {
    const map: TokenInfoMap = new Map()
    erc20Addresses.forEach((address, i) => {
      const symbolResult = tokenResults?.[i * 2]
      const decimalsResult = tokenResults?.[i * 2 + 1]
      map.set(address, {
        symbol: symbolResult?.result as string | undefined,
        decimals: decimalsResult?.result as number | undefined,
      })
    })
    return map
  }, [erc20Addresses, tokenResults])

  const {
    data: gasEstimate,
    isFetching: gasFetching,
    isError: gasError,
  } = useGasEstimate({
    calls: calls.map((c) => ({
      to: (c.to ?? zeroAddress) as Address,
      value: c.value as Hex | undefined,
      data: c.data as Hex | undefined,
    })),
  })

  if (tokensLoading) {
    return (
      <SigningLayout onConfirm={confirm} onReject={reject} disabled>
        <SigningPageSkeleton />
      </SigningLayout>
    )
  }

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
          title="Transaction Details"
          iconName="arrowSwapHorizontal"
        >
          <div className="flex flex-col gap-1">
            {calls.map((call, i) => (
              <CallItem
                key={`${call.to ?? 'unknown'}-${i}`}
                call={call}
                index={i + 1}
                tokenInfoMap={tokenInfoMap}
              />
            ))}
          </div>
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
            <DataRowSkeleton />
          )}
          <DataRow
            label="Total execution time"
            value={EXECUTION_TIME}
            iconName="clock"
          />
        </DetailsContainer>
      </div>
    </SigningLayout>
  )
}
