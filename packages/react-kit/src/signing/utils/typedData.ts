export interface DecodedTypedData {
  domain: Record<string, unknown>
  primaryType: string
  message: Record<string, unknown>
}

export function decodeTypedData(data: string): DecodedTypedData | null {
  try {
    const parsed = JSON.parse(data)
    if (!parsed.primaryType || !parsed.message) return null
    return {
      domain: parsed.domain ?? {},
      primaryType: parsed.primaryType,
      message: parsed.message,
    }
  } catch {
    return null
  }
}
