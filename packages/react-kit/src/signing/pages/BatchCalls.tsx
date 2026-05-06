import {
  type Address,
  erc20Abi,
  formatEther,
  formatUnits,
  type Hex,
  maxUint256,
} from 'viem'
import { useReadContract } from 'wagmi'

import { Text } from '../../shared/components/Text'
import { shortenHex } from '../../shared/utils/common'
import type { BatchCall } from '../../types.js'
import { DataRow } from '../components/DataRow'
import { DetailsContainer } from '../components/DetailsContainer'
import { SigningLayout } from '../components/SigningLayout'
import { TxDetailsItem } from '../components/TxDetailsItem'
import {
  decodeCollectionApproval,
  isCollectionApproval,
} from '../utils/collectionApproval.js'
import { decodeErc20Approval, isErc20Approval } from '../utils/erc20Approval.js'
import { decodeErc20Transfer, isErc20Transfer } from '../utils/erc20Transfer.js'
import { isEthTransfer } from '../utils/ethTransfer.js'

const GAS_FEE = '0.00008 ETH ($0.28)'
const EXECUTION_TIME = '≈ 1 sec'

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
  contract,
  to,
  amount,
  index,
}: {
  contract: Address
  to: Address
  amount: bigint
  index: number
}) {
  const { data: symbol } = useReadContract({
    address: contract,
    abi: erc20Abi,
    functionName: 'symbol',
  })
  const { data: decimals } = useReadContract({
    address: contract,
    abi: erc20Abi,
    functionName: 'decimals',
  })

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
  contract,
  spender,
  amount,
  index,
}: {
  contract: Address
  spender: Address
  amount: bigint
  index: number
}) {
  const { data: symbol } = useReadContract({
    address: contract,
    abi: erc20Abi,
    functionName: 'symbol',
  })
  const { data: decimals } = useReadContract({
    address: contract,
    abi: erc20Abi,
    functionName: 'decimals',
  })

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

function CallItem({ call, index }: { call: BatchCall; index: number }) {
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
      return (
        <Erc20TransferItem
          contract={call.to as Address}
          to={decoded.to}
          amount={decoded.amount}
          index={index}
        />
      )
    }
  }

  if (isErc20Approval(tx)) {
    const decoded = decodeErc20Approval(tx)
    if (decoded) {
      return (
        <Erc20ApprovalItem
          contract={call.to as Address}
          spender={decoded.spender}
          amount={decoded.amount}
          index={index}
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

export function BatchCalls({ calls, confirm, reject }: BatchCallsProps) {
  return (
    <SigningLayout onConfirm={confirm} onReject={reject}>
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
              />
            ))}
          </div>
        </DetailsContainer>
        <DetailsContainer title="Estimated Gas Fee" iconName="lightingFill">
          <DataRow label="Fee" value={GAS_FEE} iconName="gasStation" />
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
