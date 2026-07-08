import type { Config } from '@wagmi/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sepolia } from 'wagmi/chains'

// SDK mocks — hoisted so they're defined before vi.mock() (which is itself
// hoisted to the top of the file by vitest).
const {
  createKernelAccountMock,
  createKernelAccountClientMock,
  createZeroDevPaymasterClientMock,
  signerToEcdsaValidatorMock,
  createWalletClientMock,
  mockEoaAccount,
} = vi.hoisted(() => ({
  createKernelAccountMock: vi.fn().mockResolvedValue({
    address: '0xkernel000000000000000000000000000000abcd',
  }),
  createKernelAccountClientMock: vi.fn().mockReturnValue({}),
  createZeroDevPaymasterClientMock: vi.fn().mockReturnValue({}),
  signerToEcdsaValidatorMock: vi.fn().mockResolvedValue({ name: 'ecdsa' }),
  createWalletClientMock: vi.fn().mockReturnValue({}),
  mockEoaAccount: {
    address: '0xeoa000000000000000000000000000000000abcd' as const,
  },
}))

vi.mock('@zerodev/sdk', () => ({
  createKernelAccount: createKernelAccountMock,
  createKernelAccountClient: createKernelAccountClientMock,
  createZeroDevPaymasterClient: createZeroDevPaymasterClientMock,
}))
vi.mock('@zerodev/sdk/constants', () => ({
  getEntryPoint: vi.fn().mockReturnValue({ version: '0.7' }),
  KERNEL_V3_3: 'v3.3',
}))
vi.mock('@zerodev/ecdsa-validator', () => ({
  signerToEcdsaValidator: signerToEcdsaValidatorMock,
}))

// Mock viem partially — preserve `http()` etc., stub the clients we care
// about.
vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: vi.fn().mockReturnValue({}),
    createWalletClient: createWalletClientMock,
  }
})

vi.mock('@zerodev/wallet-core', () => ({
  KMS_SERVER_URL: 'https://kms.example.com',
  createZeroDevWallet: vi.fn().mockResolvedValue({
    getSession: vi.fn().mockResolvedValue(null),
    toAccount: vi.fn().mockResolvedValue(mockEoaAccount),
    auth: vi.fn(),
    logout: vi.fn().mockResolvedValue(true),
    refreshSession: vi.fn(),
  }),
}))

import { createZeroDevWallet } from '@zerodev/wallet-core'
import { zeroDevWalletCore } from './core/connector.js'

type ConnectorInstance = ReturnType<ReturnType<typeof zeroDevWalletCore>>

function createConnector(mode?: 'EOA' | '4337' | '7702'): ConnectorInstance {
  const factory = zeroDevWalletCore({
    projectId: 'proj-test',
    chains: [sepolia],
    ...(mode && { mode }),
  })
  const wagmiConfig = {
    transports: {},
    emitter: { emit: vi.fn() },
    storage: null,
  } as unknown as Config
  return factory(wagmiConfig as never) as ConnectorInstance
}

async function seedEoa(connector: ConnectorInstance) {
  // @ts-expect-error - getStore is added in the connector's Properties.
  const store = await connector.getStore()
  store.getState().setEoaAccount(mockEoaAccount)
}

describe('zeroDevWallet connector — mode branching', () => {
  beforeEach(() => {
    createKernelAccountMock.mockClear()
    createKernelAccountClientMock.mockClear()
    createZeroDevPaymasterClientMock.mockClear()
    signerToEcdsaValidatorMock.mockClear()
    createWalletClientMock.mockClear()
  })

  describe('connect()', () => {
    it("default mode is '7702' (passes eip7702Account, no ECDSA plugin)", async () => {
      const connector = createConnector()
      await seedEoa(connector)

      await connector.connect({ chainId: sepolia.id })

      expect(createKernelAccountMock).toHaveBeenCalledOnce()
      const [, params] = createKernelAccountMock.mock.calls[0]
      expect(params.eip7702Account).toBe(mockEoaAccount)
      expect(params.plugins).toBeUndefined()
      expect(signerToEcdsaValidatorMock).not.toHaveBeenCalled()
      expect(createWalletClientMock).not.toHaveBeenCalled()
    })

    it("mode='4337' builds an ECDSA-validator plugin, no eip7702Account", async () => {
      const connector = createConnector('4337')
      await seedEoa(connector)

      await connector.connect({ chainId: sepolia.id })

      expect(signerToEcdsaValidatorMock).toHaveBeenCalledOnce()
      expect(signerToEcdsaValidatorMock.mock.calls[0][1].signer).toBe(
        mockEoaAccount,
      )
      const [, params] = createKernelAccountMock.mock.calls[0]
      expect(params.eip7702Account).toBeUndefined()
      expect(params.plugins.sudo).toBeDefined()
      expect(createWalletClientMock).not.toHaveBeenCalled()
    })

    it("mode='EOA' creates a wallet client and skips the kernel entirely", async () => {
      const connector = createConnector('EOA')
      await seedEoa(connector)

      const result = await connector.connect({ chainId: sepolia.id })

      expect(createWalletClientMock).toHaveBeenCalledOnce()
      expect(createKernelAccountMock).not.toHaveBeenCalled()
      expect(signerToEcdsaValidatorMock).not.toHaveBeenCalled()
      // EOA address is what wagmi sees in EOA mode.
      expect(result.accounts).toEqual([mockEoaAccount.address])
    })

    it("mode='4337' returns the kernel counterfactual address, not the EOA", async () => {
      const connector = createConnector('4337')
      await seedEoa(connector)

      const result = await connector.connect({ chainId: sepolia.id })

      expect(result.accounts).toEqual([
        '0xkernel000000000000000000000000000000abcd',
      ])
    })
  })

  describe('getAccounts()', () => {
    it("mode='EOA' returns the EOA address before connect()", async () => {
      const connector = createConnector('EOA')
      await seedEoa(connector)

      const accounts = await connector.getAccounts()
      expect(accounts).toEqual([mockEoaAccount.address])
    })

    it("mode='4337' returns [] before connect() so we never leak the EOA address", async () => {
      const connector = createConnector('4337')
      await seedEoa(connector)

      // No connect() yet → no kernel account in store. Must NOT fall back
      // to the EOA address — that's a different account in 4337.
      const accounts = await connector.getAccounts()
      expect(accounts).toEqual([])
    })
  })
})

describe('dangerouslyOverrideOtpSignerPublicKey security guard', () => {
  const mockedCreateZeroDevWallet = vi.mocked(createZeroDevWallet)

  beforeEach(() => {
    mockedCreateZeroDevWallet.mockClear()
  })

  it('never forwards dangerouslyOverrideOtpSignerPublicKey when not set by the integrator', async () => {
    // A connector configured without the override — the common case for any
    // real integrator. createZeroDevWallet must not receive the option at all,
    // meaning encryptOtpAttempt will use the production pinned signing key.
    const connector = createConnector()
    await seedEoa(connector) // triggers doInitialize() → createZeroDevWallet()

    expect(mockedCreateZeroDevWallet).toHaveBeenCalledOnce()
    const callArgs = mockedCreateZeroDevWallet.mock.calls[0]![0]
    expect(callArgs).not.toHaveProperty('dangerouslyOverrideOtpSignerPublicKey')
  })

  it('forwards dangerouslyOverrideOtpSignerPublicKey only when explicitly set', async () => {
    // Verify the positive case: the override IS forwarded when the connector
    // is explicitly configured with it (e.g. in test environments).
    const factory = zeroDevWalletCore({
      projectId: 'proj-test',
      chains: [sepolia],
      dangerouslyOverrideOtpSignerPublicKey: 'test-signer-key',
    })
    const wagmiConfig = {
      transports: {},
      emitter: { emit: vi.fn() },
      storage: null,
    } as unknown as import('@wagmi/core').Config
    const connector = factory(wagmiConfig as never) as ConnectorInstance

    await seedEoa(connector)

    expect(mockedCreateZeroDevWallet).toHaveBeenCalledOnce()
    const callArgs = mockedCreateZeroDevWallet.mock.calls[0]![0]
    expect(callArgs).toHaveProperty(
      'dangerouslyOverrideOtpSignerPublicKey',
      'test-signer-key',
    )
  })
})
