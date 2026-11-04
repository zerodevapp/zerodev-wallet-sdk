import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'
import {
  type ThemeTokenName,
  type TokenRole,
  themeTokens,
} from '../theme/tokens'

/** The utility tails of one token role: `neutral-primary` for
 * `bg-neutral-primary`, so tailwind-merge can file `zd:bg-neutral-primary`
 * with the other background colours. */
function tokenTails(role: TokenRole): string[] {
  return (Object.keys(themeTokens) as ThemeTokenName[])
    .filter((name) => name.startsWith(`${role}-`))
    .map((name) => name.slice(role.length + 1))
}

const customTwMerge = extendTailwindMerge<'icon-color'>({
  prefix: 'zd',
  extend: {
    classGroups: {
      'font-size': [
        { text: ['h1', 'h2', 'h3', 'body1', 'body2', 'body3', 'body4'] },
      ],
      // The semantic token utilities (theme/tokens.css) merge like the
      // palette colours they replace: a later `zd:bg-*` wins.
      'bg-color': [{ bg: tokenTails('bg') }],
      'text-color': [{ text: tokenTails('text') }],
      'border-color': [{ border: tokenTails('border') }],
      // `zd:icon-*` sets `color` like `zd:text-*` does, so each displaces
      // the other; without this both would stay and stylesheet order would
      // decide.
      'icon-color': [{ icon: tokenTails('icon') }],
    },
    conflictingClassGroups: {
      'icon-color': ['text-color'],
      'text-color': ['icon-color'],
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
