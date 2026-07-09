import type { DepositedToken } from '@zerodev/smart-routing-address'
import { SUPPORTED_TOKENS } from '@zerodev/smart-routing-address'
import type { Address, Hash } from 'viem'
import { numberToHex, zeroAddress } from 'viem'
import { arbitrum, base, optimism } from 'viem/chains'
import type { EstimatedFee, SmartRoutingAddressConfig } from '../types'
import type { DepositWithSplits } from '../utils/deposits'

export const OWNER: Address = '0x1111111111111111111111111111111111111111'

export const SMART_ROUTING_ADDRESS: Address =
  '0x2222222222222222222222222222222222222222'

export const OPTIMISM_USDC = SUPPORTED_TOKENS[optimism.id]?.USDC as Address

export const TEST_PROJECT_ID = 'test-project-id'

export const TEST_CONFIG: SmartRoutingAddressConfig = {
  projectId: TEST_PROJECT_ID,
  targetChainId: base.id,
  slippage: 50,
  pollingInterval: 25,
}

export const TEST_ESTIMATED_FEES: EstimatedFee[] = [
  {
    chainId: optimism.id,
    data: [
      {
        token: OPTIMISM_USDC,
        name: 'USDC',
        decimal: 6,
        fee: numberToHex(150_000n), // 0.15 USDC
        minDeposit: numberToHex(1_000_000n), // 1 USDC
        maxDeposit: numberToHex(5_000_000_000n), // 5000 USDC
        isSponsored: false,
      },
    ],
  },
  {
    chainId: arbitrum.id,
    data: [
      {
        token: zeroAddress, // native ETH
        name: 'ETH',
        decimal: 18,
        fee: numberToHex(20_000_000_000_000n), // 0.00002 ETH
        minDeposit: numberToHex(1_000_000_000_000_000n), // 0.001 ETH
        maxDeposit: numberToHex(2_000_000_000_000_000_000n), // 2 ETH
        isSponsored: true,
      },
    ],
  },
]

export function makeDeposit(
  overrides: {
    transactionHash?: Hash
    chainId?: number
    token?: Address
    amount?: string
    bridge?: DepositedToken['bridge']
    execution?: DepositedToken['execution']
    splits?: DepositWithSplits['splits']
    error?: string | null
  } = {},
): DepositWithSplits {
  return {
    deposit: {
      chainId: overrides.chainId ?? optimism.id,
      token: overrides.token ?? OPTIMISM_USDC,
      amount: overrides.amount ?? '2000000',
      blockNumber: '100',
      transactionHash:
        overrides.transactionHash ??
        ('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hash),
    },
    bridge: overrides.bridge ?? null,
    execution: overrides.execution ?? null,
    ...(overrides.splits ? { splits: overrides.splits } : {}),
    error: overrides.error ?? null,
  }
}

export const EXECUTION_INFO: NonNullable<DepositedToken['execution']> = {
  blockNumber: '200',
  chainId: base.id,
  outputToken: SUPPORTED_TOKENS[base.id]?.USDC as Address,
  transactionHash:
    '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  outputAmount: '1850000',
}

export const BRIDGE_INFO: NonNullable<DepositedToken['bridge']> = {
  blockNumber: '150',
  transactionHash:
    '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
}
