import { getKernelAddressFromECDSA } from '@zerodev/ecdsa-validator'
import {
  getEntryPoint,
  KernelVersionToAddressesMap,
} from '@zerodev/sdk/constants'
import { KERNEL_ACCOUNT_CONFIG } from '@zerodev/wallet-react'
import { describe, expect, it } from 'vitest'
import { KERNEL_ACCOUNT_FIXTURE } from './fixtures'

const COUPLING =
  'The Data API derives 4337 addresses from the KMS EOA with this config ' +
  '(zerodev-data-api packages/data-api-contract/src/kernel-account.ts). ' +
  'Changing it moves every 4337 user to a new address and must ship with the Data API.'

describe('connector Kernel config', () => {
  it(`matches DATA_API_KERNEL_ACCOUNT. ${COUPLING}`, () => {
    expect(KERNEL_ACCOUNT_CONFIG).toEqual(KERNEL_ACCOUNT_FIXTURE.config)
  })

  it(`derives the Sepolia vector the Data API accepts. ${COUPLING}`, async () => {
    const { kernelVersion, entryPointVersion, index } = KERNEL_ACCOUNT_CONFIG
    const address = await getKernelAddressFromECDSA({
      entryPoint: getEntryPoint(entryPointVersion),
      kernelVersion,
      eoaAddress: KERNEL_ACCOUNT_FIXTURE.eoa,
      index,
      initCodeHash: KernelVersionToAddressesMap[kernelVersion].initCodeHash,
    })
    expect(address).toBe(KERNEL_ACCOUNT_FIXTURE.kernel)
  })
})
