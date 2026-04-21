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

export function capitalizeFirst(str: string): string {
  if (str.length === 0) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
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
