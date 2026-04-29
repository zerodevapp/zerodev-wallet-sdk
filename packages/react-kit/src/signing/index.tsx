import type { Address, Hex } from 'viem'
import { ScreenWrapper } from '../shared/components/ScreenWrapper'
import type { GasFee, GasTier } from './components/TxGasFees/index.js'
import type { Dapp } from './components/TxInformation/index.js'
import { usePendingRequest } from './hooks/usePendingRequest.js'
import { BatchCalls } from './pages/BatchCalls.js'
import { CollectionApproval } from './pages/CollectionApproval.js'
import { Erc20Approval } from './pages/Erc20Approval.js'
import { Erc20Transfer } from './pages/Erc20Transfer.js'
import { EthTransfer } from './pages/EthTransfer.js'
import { GenericRequest } from './pages/GenericRequest.js'
import { PersonalSign } from './pages/PersonalSign.js'
import { SignTypedData } from './pages/SignTypedData.js'
import {
  decodeCollectionApproval,
  isCollectionApproval,
} from './utils/collectionApproval.js'
import { decodeErc20Approval, isErc20Approval } from './utils/erc20Approval.js'
import { decodeErc20Transfer, isErc20Transfer } from './utils/erc20Transfer.js'
import { isEthTransfer } from './utils/ethTransfer.js'

export interface SignatureRequestProps {
  dapp: Dapp
  selectedGasTier: GasTier
  gasFees: GasFee[]
  slippage?: number
  tokenSubtitle: string
  tokenImageSource: string
  recipientImageSource: string
  spenderImageSource: string
}

export function SignatureRequest({
  dapp,
  selectedGasTier,
  gasFees,
  slippage,
  tokenSubtitle,
  tokenImageSource,
  recipientImageSource,
  spenderImageSource,
}: SignatureRequestProps) {
  const { pendingRequest, pendingRequests, confirm, reject } =
    usePendingRequest()

  if (!pendingRequest) return null

  const baseDisplay = {
    dapp,
    selectedGasTier,
    gasFees,
    ...(slippage !== undefined && { slippage }),
    tokenSubtitle,
    tokenImageSource,
  }

  const transferDisplay = {
    ...baseDisplay,
    recipientImageSource,
  }

  const approvalDisplay = {
    ...baseDisplay,
    spenderImageSource,
  }

  function renderContent() {
    switch (pendingRequest.method) {
      case 'eth_sendTransaction':
      case 'wallet_sendTransaction': {
        const tx = pendingRequest.params[0]

        if (isEthTransfer(tx)) {
          return (
            <EthTransfer
              to={tx.to as Address}
              value={tx.value as Hex}
              confirm={confirm}
              reject={reject}
              {...transferDisplay}
            />
          )
        }

        if (isErc20Transfer(tx)) {
          const decoded = decodeErc20Transfer(tx)
          if (decoded) {
            return (
              <Erc20Transfer
                contract={tx.to as Address}
                to={decoded.to}
                amount={decoded.amount}
                confirm={confirm}
                reject={reject}
                {...transferDisplay}
              />
            )
          }
        }

        if (isErc20Approval(tx)) {
          const decoded = decodeErc20Approval(tx)
          if (decoded) {
            return (
              <Erc20Approval
                contract={tx.to as Address}
                spender={decoded.spender}
                amount={decoded.amount}
                confirm={confirm}
                reject={reject}
                {...approvalDisplay}
              />
            )
          }
        }

        if (isCollectionApproval(tx)) {
          const decoded = decodeCollectionApproval(tx)
          if (decoded) {
            return (
              <CollectionApproval
                contract={tx.to as Address}
                operator={decoded.operator}
                approved={decoded.approved}
                confirm={confirm}
                reject={reject}
              />
            )
          }
        }
        break
      }

      case 'wallet_sendCalls': {
        const { calls } = pendingRequest.params[0]
        return <BatchCalls calls={calls} confirm={confirm} reject={reject} />
      }

      case 'personal_sign': {
        const [data, address] = pendingRequest.params
        return (
          <PersonalSign
            data={data}
            address={address}
            confirm={confirm}
            reject={reject}
          />
        )
      }

      case 'eth_signTypedData_v4': {
        const [address, typedData] = pendingRequest.params
        return (
          <SignTypedData
            address={address}
            typedData={typedData}
            confirm={confirm}
            reject={reject}
            dapp={dapp}
          />
        )
      }
    }

    return (
      <GenericRequest
        request={pendingRequest}
        confirm={confirm}
        reject={reject}
      />
    )
  }

  return (
    <ScreenWrapper>
      {() => (
        <div className="h-full flex flex-col" style={{ paddingTop: 20 }}>
          {renderContent()}
          {pendingRequests.length > 1 && (
            <p className="text-xs text-gray-500 mt-3">
              +{pendingRequests.length - 1} more pending{' '}
              {pendingRequests.length - 1 === 1 ? 'request' : 'requests'}
            </p>
          )}
        </div>
      )}
    </ScreenWrapper>
  )
}
