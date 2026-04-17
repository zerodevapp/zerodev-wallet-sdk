import { type Hex, hexToString } from 'viem'

export function decodePersonalSignMessage(data: Hex): string {
  try {
    return hexToString(data)
  } catch {
    return data
  }
}
