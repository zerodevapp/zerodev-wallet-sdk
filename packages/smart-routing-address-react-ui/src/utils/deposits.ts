import type { DepositedToken } from '@zerodev/smart-routing-address'
import type {
  DepositStage,
  EstimatedFee,
  SmartRoutingAddressConfig,
} from '../types'
import { resolveDestChain, resolveSourceTokens } from './config'
import { findFeeDataByToken } from './fees'
import { formatTokenAmount, truncateAddress } from './format'

export const DEPOSIT_STAGE_LABELS: Record<DepositStage, string> = {
  pending: 'Deposit detected',
  bridging: 'Bridging',
  completed: 'Completed',
  failed: 'Failed',
}

/**
 * Newer SRA servers split a deposit into legs that each carry their own
 * bridge/execution status; the published SDK types don't include the
 * field yet, so it is modeled here as an optional extension.
 */
export type DepositSplitLeg = Pick<DepositedToken, 'bridge' | 'execution'> & {
  splitIndex: number
  amount: string
}

export type DepositWithSplits = DepositedToken & {
  splits?: DepositSplitLeg[]
}

export function getDepositKey(deposit: DepositedToken): string {
  return deposit.deposit.transactionHash
}

export function getDepositStage(deposit: DepositWithSplits): DepositStage {
  if (deposit.error) return 'failed'
  // Split deposits carry bridge/execution on each leg; the top-level
  // fields stay null.
  if (deposit.splits && deposit.splits.length > 0) {
    if (deposit.splits.every((leg) => leg.execution !== null)) {
      return 'completed'
    }
    if (
      deposit.splits.some(
        (leg) => leg.bridge !== null || leg.execution !== null,
      )
    ) {
      return 'bridging'
    }
    return 'pending'
  }
  if (deposit.execution) return 'completed'
  if (deposit.bridge) return 'bridging'
  return 'pending'
}

export function getNewDeposits(
  deposits: DepositedToken[],
  baseline: ReadonlySet<string>,
): DepositedToken[] {
  return deposits.filter((deposit) => !baseline.has(getDepositKey(deposit)))
}

export type DepositSummary = {
  key: string
  stage: DepositStage
  stageLabel: string
  chainName: string
  symbol: string
  amount: string
  transactionHash: string
}

function getChainName(
  chainId: number,
  config: SmartRoutingAddressConfig,
): string {
  const destChain = resolveDestChain(config)
  if (destChain.id === chainId) return destChain.name
  const source = resolveSourceTokens(config).find(
    (token) => token.chain.id === chainId,
  )
  return source?.chain.name ?? `Chain ${chainId}`
}

export function summarizeDeposit(
  deposit: DepositedToken,
  estimatedFees: EstimatedFee[],
  config: SmartRoutingAddressConfig,
): DepositSummary {
  const { chainId, token, amount, transactionHash } = deposit.deposit
  const feeData = findFeeDataByToken(estimatedFees, chainId, token)
  const stage = getDepositStage(deposit)
  return {
    key: getDepositKey(deposit),
    stage,
    stageLabel: DEPOSIT_STAGE_LABELS[stage],
    chainName: getChainName(chainId, config),
    symbol: feeData?.name ?? truncateAddress(token),
    amount: feeData
      ? formatTokenAmount(amount, feeData.decimal)
      : String(amount),
    transactionHash,
  }
}
