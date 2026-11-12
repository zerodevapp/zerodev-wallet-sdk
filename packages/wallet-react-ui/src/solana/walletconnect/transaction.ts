import { base58, base64 } from '@scure/base'

export { base58, base64 }

/**
 * Read a compact-u16 (Solana's "shortvec") at `offset`.
 * @returns the value and the offset just past it
 */
function readCompactU16(bytes: Uint8Array, offset: number): [number, number] {
  let value = 0
  let shift = 0
  let i = offset
  for (;;) {
    const byte = bytes[i]
    if (byte === undefined) throw new Error('Transaction is truncated')
    i += 1
    value |= (byte & 0x7f) << shift
    if ((byte & 0x80) === 0) break
    shift += 7
    if (shift > 14) throw new Error('Invalid compact-u16 in transaction')
  }
  return [value, i]
}

/**
 * Return a copy of a serialized Solana transaction with `signature` written
 * into the slot that belongs to `signer`.
 *
 * WalletConnect's `solana_signTransaction` may answer with only the
 * signature (the field every wallet returns) rather than the whole signed
 * transaction, whereas the Wallet Standard feature the kit exposes promises
 * signed transaction bytes. The wire format makes the splice cheap: a
 * compact-u16 count of 64-byte signatures, then the message, whose header
 * starts (after an optional version byte) with the number of required
 * signers followed by the account keys; signer `i` owns signature slot `i`.
 */
export function withSignature(
  transaction: Uint8Array,
  signer: Uint8Array,
  signature: Uint8Array,
): Uint8Array {
  if (signature.length !== 64) throw new Error('A signature is 64 bytes')
  if (signer.length !== 32) throw new Error('A public key is 32 bytes')

  const [signatureCount, signaturesStart] = readCompactU16(transaction, 0)
  let offset = signaturesStart + signatureCount * 64
  // A versioned message flags itself with the high bit of its first byte.
  if (((transaction[offset] ?? 0) & 0x80) !== 0) offset += 1
  const requiredSigners = transaction[offset]
  if (requiredSigners === undefined) throw new Error('Transaction is truncated')
  offset += 3 // header: required signers, readonly signed, readonly unsigned
  const [keyCount, keysStart] = readCompactU16(transaction, offset)
  if (keyCount < requiredSigners || signatureCount < requiredSigners) {
    throw new Error('Transaction header is inconsistent')
  }

  let slot = -1
  for (let i = 0; i < requiredSigners; i++) {
    const start = keysStart + i * 32
    const key = transaction.subarray(start, start + 32)
    if (key.length === 32 && key.every((b, j) => b === signer[j])) {
      slot = i
      break
    }
  }
  if (slot === -1) {
    throw new Error('The signing account is not a signer of this transaction')
  }

  const signed = new Uint8Array(transaction)
  signed.set(signature, signaturesStart + slot * 64)
  return signed
}
