/**
 * Converts a DER-encoded ECDSA signature to raw r||s format.
 *
 * DER format: 0x30 [length] 0x02 [r-length] [r] 0x02 [s-length] [s]
 * Raw format: [r (32 bytes)] [s (32 bytes)]
 *
 * @param derHex - The DER-encoded signature as a hex string
 * @returns The raw signature as a hex string (r||s, 64 bytes = 128 chars)
 */
export function derToRawSignature(derHex: string): string {
  const der = hexToBytes(derHex)

  // Verify SEQUENCE tag (0x30)
  if (der[0] !== 0x30) {
    throw new Error('Invalid DER signature: expected SEQUENCE tag (0x30)')
  }

  let offset = 2 // Skip SEQUENCE tag and length

  // Parse r INTEGER
  if (der[offset] !== 0x02) {
    throw new Error('Invalid DER signature: expected INTEGER tag (0x02) for r')
  }
  offset++ // Skip INTEGER tag

  const rLength = der[offset]!
  offset++ // Skip length byte

  const rBytes = der.slice(offset, offset + rLength)
  offset += rLength

  // Parse s INTEGER
  if (der[offset] !== 0x02) {
    throw new Error('Invalid DER signature: expected INTEGER tag (0x02) for s')
  }
  offset++ // Skip INTEGER tag

  const sLength = der[offset]!
  offset++ // Skip length byte

  const sBytes = der.slice(offset, offset + sLength)

  // Remove leading zero bytes if present (DER uses signed integers)
  // and pad to 32 bytes
  const r = padTo32Bytes(stripLeadingZeros(rBytes))
  const s = padTo32Bytes(stripLeadingZeros(sBytes))

  // Concatenate r || s
  const raw = new Uint8Array(64)
  raw.set(r, 0)
  raw.set(s, 32)

  return bytesToHex(raw)
}

/**
 * Converts a hex string to a Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(cleanHex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * Converts a Uint8Array to a hex string (no 0x prefix)
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Strips leading zero bytes from a byte array
 * DER integers are signed, so positive numbers may have a leading 0x00
 */
function stripLeadingZeros(bytes: Uint8Array): Uint8Array {
  let start = 0
  while (start < bytes.length - 1 && bytes[start] === 0) {
    start++
  }
  return bytes.slice(start)
}

/**
 * Pads a byte array to 32 bytes (left-padded with zeros)
 */
function padTo32Bytes(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 32) {
    return bytes
  }
  if (bytes.length > 32) {
    // This shouldn't happen for P-256, but handle it gracefully
    return bytes.slice(bytes.length - 32)
  }
  const padded = new Uint8Array(32)
  padded.set(bytes, 32 - bytes.length)
  return padded
}
