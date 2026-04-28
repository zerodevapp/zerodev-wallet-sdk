import type { ReactNode } from 'react'
import type { Address, Hex } from 'viem'
import type { Request } from '../../types.js'
import { BatchCalls } from '../pages/BatchCalls.js'
import { CollectionApproval } from '../pages/CollectionApproval.js'
import { Erc20Approval } from '../pages/Erc20Approval.js'
import { Erc20Transfer } from '../pages/Erc20Transfer.js'
import { EthTransfer } from '../pages/EthTransfer.js'
import { GenericRequest } from '../pages/GenericRequest.js'
import { PersonalSign } from '../pages/PersonalSign.js'
import { SignTypedData } from '../pages/SignTypedData.js'
import {
  decodeCollectionApproval,
  isCollectionApproval,
} from '../utils/collectionApproval.js'
import { decodeErc20Approval, isErc20Approval } from '../utils/erc20Approval.js'
import { decodeErc20Transfer, isErc20Transfer } from '../utils/erc20Transfer.js'
import { isEthTransfer } from '../utils/ethTransfer.js'

export function renderRequestContent(
  request: Request,
  confirm: () => void,
  reject: () => void,
): ReactNode {
  switch (request.method) {
    case 'eth_sendTransaction':
    case 'wallet_sendTransaction': {
      const tx = request.params[0]

      if (isEthTransfer(tx)) {
        return (
          <EthTransfer
            to={tx.to as Address}
            value={tx.value as Hex}
            confirm={confirm}
            reject={reject}
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
      const { calls } = request.params[0]
      return <BatchCalls calls={calls} confirm={confirm} reject={reject} />
    }

    case 'personal_sign': {
      const [data, address] = request.params
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
      const [address, typedData] = request.params
      return (
        <SignTypedData
          address={address}
          typedData={typedData}
          confirm={confirm}
          reject={reject}
        />
      )
    }
  }

  return <GenericRequest request={request} confirm={confirm} reject={reject} />
}
