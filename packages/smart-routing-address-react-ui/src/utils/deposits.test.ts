import { optimism } from 'viem/chains'
import { describe, expect, it } from 'vitest'
import {
  BRIDGE_INFO,
  EXECUTION_INFO,
  makeDeposit,
  TEST_CONFIG,
  TEST_ESTIMATED_FEES,
} from '../test/fixtures'
import { getDepositStage, getNewDeposits, summarizeDeposit } from './deposits'

describe('getDepositStage', () => {
  it('is pending right after the deposit is detected', () => {
    expect(getDepositStage(makeDeposit())).toBe('pending')
  })

  it('is bridging once the bridge transaction exists', () => {
    expect(getDepositStage(makeDeposit({ bridge: BRIDGE_INFO }))).toBe(
      'bridging',
    )
  })

  it('is completed once executed', () => {
    expect(
      getDepositStage(
        makeDeposit({ bridge: BRIDGE_INFO, execution: EXECUTION_INFO }),
      ),
    ).toBe('completed')
  })

  it('is failed when an error is reported', () => {
    expect(getDepositStage(makeDeposit({ error: 'boom' }))).toBe('failed')
  })

  it('derives the stage from legs for split deposits', () => {
    const partial = makeDeposit({
      splits: [
        {
          splitIndex: 0,
          amount: '1000000',
          bridge: BRIDGE_INFO,
          execution: EXECUTION_INFO,
        },
        {
          splitIndex: 1,
          amount: '1000000',
          bridge: null,
          execution: null,
        },
      ],
    })
    expect(getDepositStage(partial)).toBe('bridging')

    const complete = makeDeposit({
      splits: [
        {
          splitIndex: 0,
          amount: '2000000',
          bridge: BRIDGE_INFO,
          execution: EXECUTION_INFO,
        },
      ],
    })
    expect(getDepositStage(complete)).toBe('completed')
  })
})

describe('getNewDeposits', () => {
  it('filters out deposits present in the baseline', () => {
    const existing = makeDeposit({ transactionHash: '0x01' })
    const fresh = makeDeposit({ transactionHash: '0x02' })
    const result = getNewDeposits(
      [existing, fresh],
      new Set([existing.deposit.transactionHash]),
    )
    expect(result).toEqual([fresh])
  })
})

describe('summarizeDeposit', () => {
  it('formats amount and symbol using fee metadata', () => {
    const summary = summarizeDeposit(
      makeDeposit({ amount: '2500000' }),
      TEST_ESTIMATED_FEES,
      TEST_CONFIG,
    )
    expect(summary.amount).toBe('2.5')
    expect(summary.symbol).toBe('USDC')
    expect(summary.chainName).toBe(optimism.name)
    expect(summary.stageLabel).toBe('Deposit detected')
  })

  it('falls back to raw values when fee metadata is missing', () => {
    const summary = summarizeDeposit(
      makeDeposit({
        chainId: 999_999,
        token: '0x3333333333333333333333333333333333333333',
        amount: '42',
      }),
      TEST_ESTIMATED_FEES,
      TEST_CONFIG,
    )
    expect(summary.amount).toBe('42')
    expect(summary.symbol).toBe('0x3333…3333')
    expect(summary.chainName).toBe('Chain 999999')
  })
})
