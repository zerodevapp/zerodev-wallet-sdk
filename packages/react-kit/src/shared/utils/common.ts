import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['h1', 'h2', 'h3', 'body1', 'body2', 'body3', 'body4'] },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return customTwMerge(clsx(inputs))
}

export function capitalizeFirst(str?: string | null): string {
  if (!str) return ''
  const first = str.at(0) ?? ''
  return first.toUpperCase() + str.slice(1)
}

export function shortenHex(hex: string, length = 4) {
  return `${hex.slice(0, length + 2)}...${hex.slice(-length)}`
}

export function camelCaseToTitle(str: string): string {
  if (str.length === 0 || str.at(0) === str.at(0)?.toUpperCase()) {
    return str
  }

  const words = str.replace(/([a-z])([A-Z])/g, '$1 $2').trim()
  return words
    .split(' ')
    .map((word) => capitalizeFirst(word))
    .join(' ')
}
