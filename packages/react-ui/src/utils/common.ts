import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const customTwMerge = extendTailwindMerge({
  prefix: 'zd',
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

/** Turn `"fromAddress"` into `"From Address"`. Leaves strings that already
 * start with uppercase (i.e. already display-cased) untouched, so callers can
 * pass either camelCase keys or human-readable labels through unchanged. */
export function camelCaseToTitle(str: string): string {
  if (str.length === 0 || str.at(0) === str.at(0)?.toUpperCase()) {
    return str
  }
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .split(' ')
    .map((word) => (word.at(0) ?? '').toUpperCase() + word.slice(1))
    .join(' ')
}
