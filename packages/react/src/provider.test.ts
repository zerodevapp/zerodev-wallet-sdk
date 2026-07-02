import type { KernelAccountClient } from '@zerodev/sdk'
import type { LocalAccount } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mainnet, sepolia } from 'wagmi/chains'
import type { WalletMode } from './connector.js'
import { createProvider } from './provider.js'
import { createZeroDevWalletStore } from './store.js'

const EOA_ADDRESS = '0xeoa000000000000000000000000000000000abcd'

const sendUserOperationMock = vi.fn()
const getUserOperationReceiptMock = vi.fn()

const mockKernelClient = {
  sendUserOperation: sendUserOperationMock,
  getUserOperationReceipt: getUserOperationReceiptMock,
} as unknown as KernelAccountClient

function createTestProvider(mode?: WalletMode) {
  const store = createZeroDevWalletStore()
  store.getState().setActiveChainId(sepolia.id)
  store.getState().setEoaAccount({ address: EOA_ADDRESS } as LocalAccount)
  store.getState().setKernelClient(sepolia.id, mockKernelClient)

  return createProvider({
    store,
    config: {
      projectId: 'proj-test',
      chains: [sepolia],
      ...(mode && { mode }),
    },
    chains: [sepolia],
  })
}

beforeEach(() => {
  sendUserOperationMock.mockReset()
  getUserOperationReceiptMock.mockReset()
})

describe('wallet_sendCalls', () => {
  it('submits a userOp and returns its hash as the bundle id', async () => {
    sendUserOperationMock.mockResolvedValue('0xuserophash')
    const provider = createTestProvider()

    const result = await provider.request({
      method: 'wallet_sendCalls',
      params: [
        {
          from: EOA_ADDRESS,
          calls: [
            { to: '0x1111111111111111111111111111111111111111', value: '0x1' },
            { data: '0xdeadbeef' },
          ],
        },
      ],
    })

    expect(result).toEqual({ id: '0xuserophash:11155111' })
    expect(sendUserOperationMock).toHaveBeenCalledWith({
      calls: [
        {
          to: '0x1111111111111111111111111111111111111111',
          value: 1n,
          data: '0x',
        },
        { value: 0n, data: '0xdeadbeef' },
      ],
    })
  })

  it('treats value "0x" as 0n (does not throw)', async () => {
    sendUserOperationMock.mockResolvedValue('0xuserophash')
    const provider = createTestProvider()

    await provider.request({
      method: 'wallet_sendCalls',
      params: [{ from: EOA_ADDRESS, calls: [{ data: '0x', value: '0x' }] }],
    })

    expect(sendUserOperationMock).toHaveBeenCalledWith({
      calls: [{ value: 0n, data: '0x' }],
    })
  })

  it('rejects in EOA mode', async () => {
    const provider = createTestProvider('EOA')

    await expect(
      provider.request({
        method: 'wallet_sendCalls',
        params: [{ calls: [{ data: '0x' }] }],
      }),
    ).rejects.toThrow('wallet_sendCalls is not supported in EOA mode')
    expect(sendUserOperationMock).not.toHaveBeenCalled()
  })

  it('rejects a mismatched from address', async () => {
    const provider = createTestProvider()

    await expect(
      provider.request({
        method: 'wallet_sendCalls',
        params: [
          {
            from: '0xdead000000000000000000000000000000000000',
            calls: [{ data: '0x' }],
          },
        ],
      }),
    ).rejects.toThrow('Invalid from address')
  })

  it.each([
    ['missing', {}],
    ['not an array', { calls: 'nope' }],
    ['empty', { calls: [] }],
  ])('rejects when calls is %s', async (_label, request) => {
    const provider = createTestProvider()

    await expect(
      provider.request({ method: 'wallet_sendCalls', params: [request] }),
    ).rejects.toThrow('Missing calls')
    expect(sendUserOperationMock).not.toHaveBeenCalled()
  })
})

describe('wallet_getCallsStatus', () => {
  it('returns pending (100) while the userOp has no receipt', async () => {
    getUserOperationReceiptMock.mockRejectedValue(new Error('not found'))
    const provider = createTestProvider()

    const result = await provider.request({
      method: 'wallet_getCallsStatus',
      params: ['0xuserophash'],
    })

    expect(result).toEqual({
      version: '2.0.0',
      atomic: true,
      status: 100,
      receipts: [],
    })
  })

  it('returns success (200) with the receipt re-encoded as RPC hex', async () => {
    getUserOperationReceiptMock.mockResolvedValue({
      success: true,
      // Scoped to this userOp — this is what must end up in the response.
      logs: [
        {
          address: '0xcontract',
          topics: ['0xtopic1', '0xtopic2'],
          data: '0xlogdata',
          blockNumber: 123n,
          logIndex: 7,
        },
      ],
      receipt: {
        transactionHash: '0xtxhash',
        blockHash: '0xblockhash',
        blockNumber: 123n,
        gasUsed: 456n,
        status: 'success',
        logs: [{ address: '0xother', topics: [], data: '0x' }],
      },
    })
    const provider = createTestProvider()

    const result = await provider.request({
      method: 'wallet_getCallsStatus',
      params: ['0xuserophash'],
    })

    expect(result).toEqual({
      version: '2.0.0',
      atomic: true,
      chainId: `0x${sepolia.id.toString(16)}`,
      status: 200,
      receipts: [
        {
          transactionHash: '0xtxhash',
          blockHash: '0xblockhash',
          blockNumber: '0x7b',
          gasUsed: '0x1c8',
          status: '0x1',
          logs: [
            {
              address: '0xcontract',
              topics: ['0xtopic1', '0xtopic2'],
              data: '0xlogdata',
            },
          ],
        },
      ],
    })
  })

  it('returns failure (500) when the userOp reverted', async () => {
    getUserOperationReceiptMock.mockResolvedValue({
      success: false,
      logs: [],
      receipt: {
        transactionHash: '0xtxhash',
        blockHash: '0xblockhash',
        blockNumber: 123n,
        gasUsed: 456n,
        status: 'reverted',
        logs: [],
      },
    })
    const provider = createTestProvider()

    const result = (await provider.request({
      method: 'wallet_getCallsStatus',
      params: ['0xuserophash'],
    })) as { status: number; receipts: { status: string }[] }

    expect(result.status).toBe(500)
    expect(result.receipts[0].status).toBe('0x0')
  })

  it("reports the bundle id's chain, not the active chain", async () => {
    getUserOperationReceiptMock.mockResolvedValue({
      success: true,
      logs: [],
      receipt: {
        transactionHash: '0xtxhash',
        blockHash: '0xblockhash',
        blockNumber: 1n,
        gasUsed: 1n,
        status: 'success',
        logs: [],
      },
    })
    // Active chain is sepolia, but the bundle was submitted on mainnet — the
    // status response must reflect the bundle's chain, not the active one.
    const store = createZeroDevWalletStore()
    store.getState().setActiveChainId(sepolia.id)
    store.getState().setEoaAccount({ address: EOA_ADDRESS } as LocalAccount)
    store.getState().setKernelClient(mainnet.id, mockKernelClient)
    const provider = createProvider({
      store,
      config: { projectId: 'proj-test', chains: [sepolia, mainnet] },
      chains: [sepolia, mainnet],
    })

    const result = (await provider.request({
      method: 'wallet_getCallsStatus',
      params: [`0xuserophash:${mainnet.id}`],
    })) as { chainId: string }

    expect(result.chainId).toBe(`0x${mainnet.id.toString(16)}`)
  })
})

describe('wallet_getCapabilities', () => {
  it('declares atomic support for requested chains in kernel modes', async () => {
    const provider = createTestProvider()

    const result = await provider.request({
      method: 'wallet_getCapabilities',
      params: [EOA_ADDRESS, ['0xaa36a7', '0x1']],
    })

    expect(result).toEqual({
      '0xaa36a7': { atomic: { status: 'supported' } },
      '0x1': { atomic: { status: 'supported' } },
    })
  })

  it('falls back to the active chain when no chains are requested', async () => {
    const provider = createTestProvider()

    const result = await provider.request({
      method: 'wallet_getCapabilities',
    })

    expect(result).toEqual({
      [`0x${sepolia.id.toString(16)}`]: {
        atomic: { status: 'supported' },
      },
    })
  })

  it('declares atomic unsupported in EOA mode', async () => {
    const provider = createTestProvider('EOA')

    const result = (await provider.request({
      method: 'wallet_getCapabilities',
      params: [EOA_ADDRESS, ['0xaa36a7']],
    })) as Record<string, { atomic: { status: string } }>

    expect(result['0xaa36a7'].atomic.status).toBe('unsupported')
  })
})
