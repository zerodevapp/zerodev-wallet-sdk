import { type Hex, hexToString } from 'viem'

export function decodePersonalSignMessage(data: Hex): string | null {
  try {
    return hexToString(data)
  } catch {
    return null
  }
}
