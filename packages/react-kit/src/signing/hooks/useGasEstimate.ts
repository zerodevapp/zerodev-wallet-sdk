'use client'

import { useQuery } from '@tanstack/react-query'
import type { ZeroDevWalletState } from '@zerodev/wallet-react'
import type { Address, Hex } from 'viem'
import { useAccount, useConfig } from 'wagmi'

type UseGasEstimateParams = {
  to: Address
  value?: Hex
  data?: Hex
}

export function useGasEstimate({ to, value, data }: UseGasEstimateParams) {
  const config = useConfig()
  const { chainId } = useAccount()

  return useQuery({
    queryKey: ['userop-gas-estimate', chainId, to, value, data],
    refetchInterval: 12_000,
    enabled: !!chainId,
    queryFn: async (): Promise<bigint | null> => {
      const connector = config.connectors.find((c) => c.id === 'zerodev-wallet')
      if (!connector || !('getStore' in connector)) return null
      // @ts-expect-error - getStore is a custom method on the base connector
      const store = await connector.getStore()
      const { activeChainId, kernelClients } =
        store.getState() as ZeroDevWalletState
      const kernelClient = activeChainId
        ? kernelClients.get(activeChainId)
        : undefined
      if (!kernelClient) return null
      const account = kernelClient.account
      if (!account) return null

      // TODO: handle sponsorship — when a paymaster is configured on the
      // dashboard, the user's actual cost is $0 and this displayed fee is
      // misleading.
      const userOp = await kernelClient.prepareUserOperation({
        account,
        calls: [
          {
            to,
            value: value ? BigInt(value) : 0n,
            data: data ?? '0x',
          },
        ],
      })
      const totalGas =
        userOp.preVerificationGas +
        userOp.verificationGasLimit +
        userOp.callGasLimit
      return totalGas * userOp.maxFeePerGas
    },
  })
}
