import { BaseError, decodeErrorResult, type Hex } from 'viem'

interface TxErrorInfo {
  title: string
  description: string
}

// Replace any embedded `Error(string)` revert hex (selector 0x08c379a0)
// with its decoded string. Bundler-wrapped errors surface the raw hex.
function decodeErrorHex(message: string): string {
  return message.replace(/0x08c379a0[0-9a-fA-F]+/g, (match) => {
    try {
      const decoded = decodeErrorResult({
        abi: [{ type: 'error', name: 'Error', inputs: [{ type: 'string' }] }],
        data: match as Hex,
      })
      return decoded.args[0] as string
    } catch {
      return match
    }
  })
}

export function getTxErrorInfo(error: Error): TxErrorInfo {
  const shortMessage = error instanceof BaseError ? error.shortMessage : null
  const baseMessage = shortMessage ?? error.message
  const message = decodeErrorHex(baseMessage)

  if (
    message.toLowerCase().includes('insufficient funds') ||
    message.toLowerCase().includes('transfer amount exceeds balance')
  ) {
    return {
      title: 'Insufficient funds',
      description:
        "You don't have enough funds to cover the amount plus gas fees.",
    }
  }

  return {
    title: 'Unable to process transaction',
    description: message,
  }
}
