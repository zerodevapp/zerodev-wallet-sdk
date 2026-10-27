/**
 * Backend E2E for Server Wallets signing, against the deployed KMS and Turnkey.
 *
 * Every case signs as `ZD_SW_ADDRESS`, an address derived once out of band. The suite
 * creates and derives nothing, so it is idempotent and safe to run on a schedule.
 */

import {
  concat,
  type Hex,
  hashMessage,
  hashTypedData,
  isAddressEqual,
  keccak256,
  numberToHex,
  parseSignature,
  parseTransaction,
  recoverMessageAddress,
  recoverTransactionAddress,
  serializeTransaction,
  toRlp,
} from 'viem'
import { hashAuthorization } from 'viem/utils'
import { describe, expect, it } from 'vitest'
import {
  createServerWalletClients,
  expectRecoversTo,
  expectRefusal,
  rejection,
  serverWalletEnv,
} from '../helpers/server-wallet.js'

const CHAIN_ID = 421614
/** Any address works: the signature is over hash(chainId, address, nonce). */
const DELEGATE = '0x0000000000000000000000000000000000007702' as Hex
const NONCE = 0

/** Serialized as `adapters/viem.ts` does: 0x05 || RLP([chainId, address, nonce]). */
function unsigned7702(chainId: number, delegate: Hex, nonce: number) {
  return concat([
    '0x05',
    toRlp([
      chainId ? numberToHex(chainId) : '0x',
      delegate,
      nonce ? numberToHex(nonce) : '0x',
    ]),
  ]).slice(2)
}

describe('Server Wallets · signing', () => {
  const { client, serverWallet } = createServerWalletClients()
  const { organizationId, projectId, address } = serverWalletEnv()

  const checkTypedData = (note: string) =>
    ({
      domain: { name: 'ServerWalletCheck', version: '1', chainId: CHAIN_ID },
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
        ],
        Check: [
          { name: 'from', type: 'address' },
          { name: 'note', type: 'string' },
        ],
      },
      primaryType: 'Check',
      message: { from: address, note },
    }) as const

  const hashDoc = (doc: ReturnType<typeof checkTypedData>): Hex =>
    hashTypedData(doc as Parameters<typeof hashTypedData>[0])

  const signUtf8 = (message: string) =>
    client.signMessage({
      organizationId,
      projectId,
      address,
      message,
      encoding: 'utf8',
    })

  it('signs a utf8 message that recovers to the wallet', async () => {
    const message = `server wallet check ${new Date().toISOString()}`
    const signature = await signUtf8(message)

    // recoverMessageAddress applies EIP-191 itself, so this checks the SDK's hashing too.
    const recovered = await recoverMessageAddress({ message, signature })
    expect(isAddressEqual(recovered, address)).toBe(true)
  })

  it('signs a hex message that recovers to the wallet', async () => {
    const raw = keccak256(`0x${Buffer.from('raw bytes').toString('hex')}`)
    const signature = await client.signMessage({
      organizationId,
      projectId,
      address,
      message: raw.slice(2),
      encoding: 'hex',
    })

    await expectRecoversTo(hashMessage({ raw }), signature, address)
  })

  it('either signs an empty message or refuses it attributably', async () => {
    let signature: Hex | undefined
    let rejected: unknown
    try {
      signature = await signUtf8('')
    } catch (error) {
      rejected = error
    }

    if (signature === undefined) {
      expectRefusal('an empty message', rejected, {
        status: 400,
        code: 'validation_failed',
      })
      return
    }

    const recovered = await recoverMessageAddress({ message: '', signature })
    expect(isAddressEqual(recovered, address)).toBe(true)
  })

  it('signs a transaction over the hash of the bytes it was given', async () => {
    const unsigned = serializeTransaction({
      chainId: CHAIN_ID,
      to: '0x0000000000000000000000000000000000000001',
      value: 0n,
      nonce: 0,
      gas: 21_000n,
      maxFeePerGas: 1_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
      type: 'eip1559',
    })

    const signature = await client.signTransaction({
      organizationId,
      projectId,
      address,
      unsignedTransaction: unsigned.slice(2), // hex without 0x, per the param doc
    })

    await expectRecoversTo(keccak256(unsigned), signature, address)
  })

  it('reattaches the signature without moving any transaction field', async () => {
    const tx = {
      chainId: CHAIN_ID,
      type: 'eip1559' as const,
      to: address,
      // Non-zero on purpose: at 0n the comparison below is vacuous, because RLP encodes
      // zero as empty and it would be 0n against a defaulted 0n either way.
      value: 1n,
      nonce: 3,
      gas: 21_000n,
      maxFeePerGas: 1_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
    }

    const signature = await client.signTransaction({
      organizationId,
      projectId,
      address,
      unsignedTransaction: serializeTransaction(tx).slice(2),
    })

    const signed = serializeTransaction(tx, parseSignature(signature))
    const parsed = parseTransaction(signed)
    const sender = await recoverTransactionAddress({
      serializedTransaction: signed,
    })
    expect(isAddressEqual(sender, address)).toBe(true)

    // `value` is defaulted because RLP encodes zero as the empty byte string and viem's
    // parseTransaction returns that as undefined rather than 0n.
    expect({
      chainId: parsed.chainId,
      nonce: parsed.nonce,
      to: parsed.to?.toLowerCase(),
      value: parsed.value ?? 0n,
      gas: parsed.gas,
      maxFeePerGas: parsed.maxFeePerGas,
      maxPriorityFeePerGas: parsed.maxPriorityFeePerGas,
    }).toEqual({
      chainId: tx.chainId,
      nonce: tx.nonce,
      to: tx.to.toLowerCase(),
      value: tx.value,
      gas: tx.gas,
      maxFeePerGas: tx.maxFeePerGas,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
    })
  })

  it('signs typed data over the hash of the document it was given', async () => {
    const typedData = checkTypedData('server wallet check')
    const hash = hashDoc(typedData)

    const signature = await client.signTypedDataV4({
      organizationId,
      projectId,
      address,
      unsignedTypedDataV4: JSON.stringify(typedData),
      encoding: 'utf8',
      typedDataHash: hash.slice(2),
    })

    await expectRecoversTo(hash, signature, address)
  })

  it('refuses a typedDataHash crossed with another document', async () => {
    const sent = checkTypedData('transfer 1 wei to a friend')
    const otherHash = hashDoc(
      checkTypedData('transfer 1000 ether to an attacker'),
    )

    const error = await rejection(() =>
      client.signTypedDataV4({
        organizationId,
        projectId,
        address,
        unsignedTypedDataV4: JSON.stringify(sent),
        encoding: 'utf8',
        typedDataHash: otherHash.slice(2),
      }),
    )

    expectRefusal('a crossed typedDataHash', error, {
      status: 400,
      code: 'invalid_request',
    })
  })

  it('signs a user operation hash as raw bytes through toAccount', async () => {
    const userOpHash = keccak256(
      `0x${Buffer.from('server wallet user operation').toString('hex')}`,
    )
    const account = await serverWallet.toAccount({ address })

    const signature = await account.signMessage({
      message: { raw: userOpHash },
    })

    await expectRecoversTo(hashMessage({ raw: userOpHash }), signature, address)
  })

  it('produces a different signature on the UTF8 branch', async () => {
    const userOpHash = keccak256(
      `0x${Buffer.from('server wallet user operation').toString('hex')}`,
    )
    const account = await serverWallet.toAccount({ address })

    const raw = await account.signMessage({ message: { raw: userOpHash } })
    const text = await account.signMessage({ message: userOpHash })

    expect(raw).not.toBe(text)
    // Both recover under their own encoding. That is the trap, stated as a result.
    await expectRecoversTo(hashMessage({ raw: userOpHash }), raw, address)
    await expectRecoversTo(hashMessage(userOpHash), text, address)
  })

  it('signs the same payload twice, both recovering to the wallet', async () => {
    const message = `the same payload twice ${new Date().toISOString()}`
    const first = await signUtf8(message)
    const second = await signUtf8(message)

    for (const signature of [first, second]) {
      const recovered = await recoverMessageAddress({ message, signature })
      expect(isAddressEqual(recovered, address)).toBe(true)
    }
  })

  it('signs concurrently without reusing a stamp', async () => {
    const messages = [1, 2, 3, 4, 5].map((n) => `concurrent payload ${n}`)
    const signatures = await Promise.all(messages.map(signUtf8))

    for (const [i, signature] of signatures.entries()) {
      const recovered = await recoverMessageAddress({
        message: messages[i] as string,
        signature,
      })
      expect(isAddressEqual(recovered, address)).toBe(true)
    }
    expect(new Set(signatures).size).toBe(signatures.length)
  })

  it('signs through the viem account', async () => {
    const account = await serverWallet.toAccount({ address })
    const message = `viem account ${new Date().toISOString()}`

    const signature = await account.signMessage({ message })

    await expectRecoversTo(hashMessage(message), signature, address)
  })

  it('signs an EIP-7702 authorization', async () => {
    const hashedAuthorization = hashAuthorization({
      address: DELEGATE,
      chainId: CHAIN_ID,
      nonce: NONCE,
    })

    const signature = await client.sign7702Authorization({
      organizationId,
      projectId,
      address,
      unsignedTransaction: unsigned7702(CHAIN_ID, DELEGATE, NONCE),
      hashedAuthorization: hashedAuthorization.slice(2),
    })

    await expectRecoversTo(hashedAuthorization, signature, address)
  })

  it('refuses an authorization hash crossed with another delegation', async () => {
    const otherHash = hashAuthorization({
      address: '0x000000000000000000000000000000000000dEaD',
      chainId: CHAIN_ID,
      nonce: NONCE,
    })

    const error = await rejection(() =>
      client.sign7702Authorization({
        organizationId,
        projectId,
        address,
        unsignedTransaction: unsigned7702(CHAIN_ID, DELEGATE, NONCE),
        hashedAuthorization: otherHash.slice(2),
      }),
    )

    expectRefusal('a crossed authorization hash', error, {
      status: 400,
      code: 'invalid_request',
    })
  })

  it('signs a 7702 authorization through the viem account', async () => {
    const account = await serverWallet.toAccount({ address })

    if (!account.signAuthorization) {
      throw new Error('the account exposes no signAuthorization')
    }
    const nonce = NONCE + 1

    const authorization = await account.signAuthorization({
      contractAddress: DELEGATE,
      chainId: CHAIN_ID,
      nonce,
    })

    expect(isAddressEqual(authorization.address, DELEGATE)).toBe(true)
    expect(authorization.chainId).toBe(CHAIN_ID)
    expect(authorization.nonce).toBe(nonce)

    await expectRecoversTo(
      hashAuthorization({ address: DELEGATE, chainId: CHAIN_ID, nonce }),
      `0x${authorization.r.slice(2)}${authorization.s.slice(2)}${(authorization.yParity ?? 0) === 0 ? '1b' : '1c'}`,
      address,
    )
  })
})
