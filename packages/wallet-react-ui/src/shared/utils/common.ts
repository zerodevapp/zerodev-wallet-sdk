export function capitalizeFirst(str?: string | null): string {
  if (!str) return ''
  const first = str.at(0) ?? ''
  return first.toUpperCase() + str.slice(1)
}

export function shortenHex(hex: string, length = 4) {
  return `${hex.slice(0, length + 2)}...${hex.slice(-length)}`
}

/** Case-insensitive equality, ignoring surrounding whitespace. */
export function equalsIgnoreCase(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export function isValidEmailAddress(email: string): boolean {
  return EMAIL_REGEX.test(email.trim())
}
