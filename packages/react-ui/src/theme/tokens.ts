/**
 * The vocabulary of the semantic colour tokens. `tokens.css` is the single
 * source of truth for which tokens exist and what they are worth; this file
 * only names the parts a token name is made of, `<role>-<group>-<step>`, so
 * a token override can be typed without a second copy of the list. Not every
 * combination is a token: an override for a name no token uses sets a custom
 * property nothing reads.
 */

export const THEME_MODES = ['light', 'dark'] as const
export const THEME_BRANDS = ['branded', 'plain'] as const

export type ThemeMode = (typeof THEME_MODES)[number]
export type ThemeBrand = (typeof THEME_BRANDS)[number]

export const TOKEN_ROLES = ['bg', 'text', 'icon', 'border'] as const
export const TOKEN_GROUPS = [
  'neutral',
  'bright',
  'inverse',
  'brand',
  'surface',
  'surface-bright',
  'frame',
  'success',
  'warning',
  'error',
  'info',
] as const
export const TOKEN_STEPS = [
  'primary',
  'secondary',
  'tertiary',
  'disabled',
  'hover',
  'inverse',
  'subtle',
  'bold',
  'ring',
] as const

export type TokenRole = (typeof TOKEN_ROLES)[number]
export type TokenGroup = (typeof TOKEN_GROUPS)[number]
export type TokenStep = (typeof TOKEN_STEPS)[number]

export type ThemeTokenName = `${TokenRole}-${TokenGroup}-${TokenStep}`

/** The CSS custom property a token is read from, e.g. `--zd-bg-neutral-primary`. */
export function themeTokenVar(name: ThemeTokenName): `--zd-${ThemeTokenName}` {
  return `--zd-${name}`
}

/**
 * The variants `tokens.css` carries values for. A preset for any other
 * variant paints the default values. Extend this when a variant's values
 * land in the stylesheet. Branded dark is held back: the branded art
 * (Screen's card base and glow) has no dark design yet, so shipping the
 * dark colours alone would set off-white text on a light card.
 */
export const SHIPPED_THEME_VARIANTS = [
  { mode: 'light', brand: 'branded' },
  { mode: 'light', brand: 'plain' },
  { mode: 'dark', brand: 'plain' },
] as const satisfies readonly { mode: ThemeMode; brand: ThemeBrand }[]

export function isThemeVariantShipped(
  mode: ThemeMode,
  brand: ThemeBrand,
): boolean {
  return SHIPPED_THEME_VARIANTS.some(
    (v) => v.mode === mode && v.brand === brand,
  )
}
