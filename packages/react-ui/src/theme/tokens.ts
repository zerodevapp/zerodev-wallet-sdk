/**
 * Semantic colour tokens: the single source of truth for every themed colour
 * in the UI packages. Mirrors the "ZeroDev Design System" Figma variable
 * collection, whose four modes form a 2×2 grid: light or dark × branded or
 * plain. `scripts/gen-tokens.mjs` turns this table into `tokens.css` (the
 * CSS custom properties plus one Tailwind utility per token); run
 * `pnpm gen:tokens` after editing and commit both files. `tokens.test.ts`
 * fails when the two drift apart.
 *
 * Every value carries its own alpha, as in Figma (`#rrggbbaa`), so the
 * utilities take no opacity modifier: `zd:bg-neutral-secondary` is already
 * the translucent surface the design shows.
 *
 * This file is imported by Node directly (type stripping), so it must stay
 * erasable TypeScript: no enums, namespaces or parameter properties.
 */

export const THEME_MODES = ['light', 'dark'] as const
export const THEME_BRANDS = ['branded', 'plain'] as const

export type ThemeMode = (typeof THEME_MODES)[number]
export type ThemeBrand = (typeof THEME_BRANDS)[number]

/** One cell of the grid, and the column order of every row below. */
export const THEME_VARIANTS = [
  { mode: 'light', brand: 'branded' },
  { mode: 'light', brand: 'plain' },
  { mode: 'dark', brand: 'branded' },
  { mode: 'dark', brand: 'plain' },
] as const satisfies readonly { mode: ThemeMode; brand: ThemeBrand }[]

export type ThemeVariant = (typeof THEME_VARIANTS)[number]

/** The variant the stylesheet applies with no theme selected: today's look. */
export const DEFAULT_THEME_VARIANT = THEME_VARIANTS[0]

/**
 * A token's value in each variant, in `THEME_VARIANTS` order. `null` marks a
 * cell the design file does not state yet; the generator refuses to emit a
 * variant with a null cell, so a preset cannot ship half-defined.
 */
export type ThemeValues = readonly [
  brandedLight: string,
  plainLight: string | null,
  brandedDark: string | null,
  plainDark: string | null,
]

/**
 * What a token's role paints. `icon` is a colour like `text`: icons draw
 * with `currentColor`, and a separate role keeps the Figma distinction
 * (icons are a shade stronger than text in some variants).
 */
export const TOKEN_ROLES = {
  bg: 'background-color',
  text: 'color',
  icon: 'color',
  border: 'border-color',
} as const

export type TokenRole = keyof typeof TOKEN_ROLES

// Columns: light/branded, light/plain, dark/branded, dark/plain.
// Groups follow the Figma rows: Neutral, Bright Neutral, Neutral Inverse,
// Brand, Surface, Surface Bright Neutral, then the four semantic colours.
// biome-ignore format: one row per token keeps the four columns readable
export const themeTokens = {
  // --- Background ---------------------------------------------------------
  // Plain dark card: the design binds 90% ink over a near-black canvas,
  // which renders as #15110e; that opaque value is used so the card looks
  // the same on a light host page (90% ink over white reads brown).
  'bg-neutral-primary': ['#f7f5f0cc', '#f7f5f0cc', '#130e0bcc', '#15110e'],
  'bg-neutral-secondary': ['#f7f5f066', '#f7f5f0cc', '#f7f5f00d', '#f7f5f00d'],
  'bg-neutral-tertiary': ['#ffffff33', '#ffffff80', '#f7f5f01a', '#f7f5f00d'],
  'bg-neutral-disabled': ['#ffffff0d', '#ffffff0d', '#ffffff0d', '#ffffff0d'],
  // Dark cells: the values the wallet screens (ZeroDev-Wallet-UX) bind, an
  // off-white tint for tiles and surfaces. The design-system file's own
  // swatch table shows white at 100/50/20% here instead; the screens are
  // what ships, so they win until design reconciles the two. Tertiary is
  // not bound anywhere: 3% continues the 10/5 step.
  'bg-bright-primary': ['#ffffff', '#ffffff', '#f7f5f01a', '#f7f5f01a'],
  'bg-bright-secondary': ['#ffffff80', '#ffffff80', '#f7f5f00d', '#f7f5f00d'],
  'bg-bright-tertiary': ['#ffffff33', '#ffffff33', '#f7f5f008', '#f7f5f008'],
  'bg-inverse-primary': ['#130e0b', '#130e0b', '#f7f5f0', '#f7f5f0'],
  'bg-inverse-secondary': ['#130e0be5', '#130e0be5', '#f7f5f0cc', '#f7f5f0'],
  'bg-inverse-tertiary': ['#130e0b80', '#130e0b80', '#f7f5f080', '#f7f5f080'],
  'bg-inverse-hover': ['#130e0b1a', '#ffffff', '#f7f5f01a', '#f7f5f01a'],
  // Plain variants fold the brand onto neutrals.
  'bg-brand-primary': ['#e76000', '#130e0b', '#e76000', '#f7f5f0'],
  'bg-brand-secondary': ['#fac8ab', '#130e0b08', '#4a2714', '#f7f5f00d'],
  'bg-brand-tertiary': ['#f27b3e1a', '#130e0b1a', '#e7600033', '#f7f5f01a'],
  'bg-surface-primary': ['#f7f5f0cc', '#f7f5f0cc', '#130e0be5', '#130e0be5'],
  'bg-surface-secondary': ['#f7f5f066', '#f7f5f066', '#f7f5f00d', '#f7f5f00d'],
  'bg-surface-tertiary': ['#f7f5f033', '#f7f5f033', '#f7f5f01a', '#f7f5f01a'],
  // Dark cells: as for bg-bright-*.
  'bg-surface-bright-primary': ['#ffffff', '#ffffff', '#f7f5f01a', '#f7f5f01a'],
  'bg-surface-bright-secondary': ['#ffffff80', '#ffffff80', '#f7f5f00d', '#f7f5f00d'],
  'bg-surface-bright-tertiary': ['#ffffff33', '#ffffff33', '#f7f5f008', '#f7f5f008'],
  // The 6px band around the card under the plain brand ("Background /
  // Non-branded Background" in the wallet screens, 10% off-white, which
  // renders as #252525 over the design's canvas: opaque here for the same
  // reason as the card). The branded art covers it in the branded variants.
  'bg-frame-ring': ['#f7f5f0', '#f7f5f0', '#252525', '#252525'],
  'bg-success-subtle': ['#2283001a', '#2283001a', '#22830033', '#22830033'],
  'bg-success-bold': ['#228300', '#228300', '#228300', '#228300'],
  'bg-warning-subtle': ['#f27b3e1a', '#f27b3e1a', '#e7600033', '#e7600033'],
  'bg-warning-bold': ['#e76000', '#e76000', '#e76000', '#e76000'],
  'bg-error-subtle': ['#ff42211a', '#ff42211a', '#ff422133', '#ff422133'],
  'bg-error-bold': ['#ff4221', '#ff4221', '#ff4221', '#ff4221'],
  'bg-info-subtle': ['#45abfb1a', '#45abfb1a', '#45abfb33', '#45abfb33'],
  'bg-info-bold': ['#45abfb', '#45abfb', '#45abfb', '#45abfb'],

  // --- Text ---------------------------------------------------------------
  'text-neutral-primary': ['#130e0b', '#130e0b', '#f7f5f0', '#f7f5f0'],
  'text-neutral-secondary': ['#130e0bcc', '#130e0b', '#f7f5f0cc', '#f7f5f0cc'],
  'text-neutral-tertiary': ['#130e0b80', '#130e0b80', '#f7f5f080', '#f7f5f080'],
  'text-neutral-disabled': ['#130e0b4d', '#130e0b4d', '#f7f5f033', '#f7f5f033'],
  'text-inverse-primary': ['#f7f5f0', '#f7f5f0', '#130e0b', '#130e0b'],
  'text-inverse-secondary': ['#f7f5f0', '#f7f5f0', '#130e0bcc', '#130e0bcc'],
  'text-inverse-tertiary': ['#f7f5f0cc', '#f7f5f0cc', '#130e0bb2', '#130e0bb2'],
  'text-brand-primary': ['#e76000', '#130e0b', '#ff8a3d', '#f7f5f0'],
  'text-brand-inverse': ['#f7f5f0', '#f7f5f0', '#ffffff', '#130e0b'],
  'text-success-primary': ['#228300', '#228300', '#5fd13a', '#5fd13a'],
  'text-success-inverse': ['#f7f5f0', '#f7f5f0', '#f7f5f0', '#f7f5f0'],
  'text-warning-primary': ['#e76000', '#e76000', '#ff8a3d', '#ff8a3d'],
  'text-warning-inverse': ['#f7f5f0', '#f7f5f0', '#ffffff', '#ffffff'],
  'text-error-primary': ['#ff4221', '#ff4221', '#ff6a4d', '#ff6a4d'],
  'text-error-inverse': ['#f7f5f0', '#f7f5f0', '#130e0b', '#130e0b'],
  'text-info-primary': ['#130e0b', '#130e0b', '#7cc4ff', '#7cc4ff'],
  'text-info-inverse': ['#130e0b', '#130e0b', '#130e0b', '#130e0b'],

  // --- Icon ---------------------------------------------------------------
  'icon-neutral-primary': ['#130e0b', '#130e0b', '#f7f5f0', '#f7f5f0'],
  'icon-neutral-secondary': ['#130e0b', '#130e0b', '#f7f5f0cc', '#f7f5f0cc'],
  'icon-neutral-tertiary': ['#130e0bb2', '#130e0bb2', '#f7f5f080', '#f7f5f080'],
  'icon-neutral-disabled': ['#130e0b4d', '#130e0b4d', '#f7f5f033', '#f7f5f033'],
  'icon-inverse-primary': ['#f7f5f0', '#f7f5f0', '#130e0b', '#130e0b'],
  'icon-inverse-secondary': ['#f7f5f0', '#f7f5f0', '#130e0bcc', '#130e0bcc'],
  'icon-inverse-tertiary': ['#f7f5f0cc', '#f7f5f0cc', '#130e0bb2', '#130e0bb2'],
  'icon-brand-primary': ['#e76000', '#130e0b', '#ff8a3d', '#f7f5f0'],
  'icon-brand-inverse': ['#f7f5f0', '#f7f5f0', '#ffffff', '#130e0b'],
  'icon-success-primary': ['#228300', '#228300', '#5fd13a', '#5fd13a'],
  'icon-success-inverse': ['#f7f5f0', '#f7f5f0', '#f7f5f0', '#f7f5f0'],
  'icon-warning-primary': ['#e76000', '#e76000', '#ff8a3d', '#ff8a3d'],
  'icon-warning-inverse': ['#f7f5f0', '#f7f5f0', '#ffffff', '#ffffff'],
  'icon-error-primary': ['#ff4221', '#ff4221', '#ff6a4d', '#ff6a4d'],
  'icon-error-inverse': ['#f7f5f0', '#f7f5f0', '#130e0b', '#130e0b'],
  'icon-info-primary': ['#130e0b', '#130e0b', '#7cc4ff', '#7cc4ff'],
  'icon-info-inverse': ['#130e0b', '#130e0b', '#130e0b', '#130e0b'],

  // --- Border -------------------------------------------------------------
  'border-neutral-primary': ['#f7f5f0', '#f7f5f0', '#f7f5f01a', '#f7f5f01a'],
  'border-neutral-secondary': ['#f7f5f066', '#f7f5f066', '#f7f5f00d', '#f7f5f00d'],
  'border-inverse-primary': ['#130e0b', '#130e0b', '#f7f5f0', '#f7f5f0'],
  'border-inverse-secondary': ['#130e0b4d', '#130e0b4d', '#f7f5f066', '#f7f5f066'],
  'border-brand-primary': ['#f27b3e1a', '#f27b3e1a', '#e7600033', '#f7f5f01a'],
  'border-brand-inverse': ['#e76000', '#130e0b', '#ff8a3d', '#f7f5f0'],
  'border-success-primary': ['#2283001a', '#2283001a', '#22830033', '#22830033'],
  'border-success-inverse': ['#228300', '#228300', '#5fd13a', '#5fd13a'],
  'border-warning-primary': ['#f27b3e1a', '#f27b3e1a', '#e7600033', '#e7600033'],
  'border-warning-inverse': ['#e76000', '#e76000', '#ff8a3d', '#ff8a3d'],
  'border-error-primary': ['#ff42211a', '#ff42211a', '#ff422133', '#ff422133'],
  'border-error-inverse': ['#ff4221', '#ff4221', '#ff6a4d', '#ff6a4d'],
  'border-info-primary': ['#45abfb1a', '#45abfb1a', '#45abfb33', '#45abfb33'],
  'border-info-inverse': ['#45abfb', '#45abfb', '#7cc4ff', '#7cc4ff'],
} as const satisfies Record<`${TokenRole}-${string}`, ThemeValues>

export type ThemeTokenName = keyof typeof themeTokens

/** Column of `variant` in every row of the table. */
export function themeVariantIndex(mode: ThemeMode, brand: ThemeBrand): number {
  return THEME_VARIANTS.findIndex((v) => v.mode === mode && v.brand === brand)
}

/**
 * Whether every token states a value for the variant. The stylesheet only
 * carries complete variants, so a preset for an incomplete one falls back
 * to the default values.
 */
export function isThemeVariantComplete(
  mode: ThemeMode,
  brand: ThemeBrand,
  tokens: Record<string, ThemeValues> = themeTokens,
): boolean {
  const column = themeVariantIndex(mode, brand)
  return (
    column >= 0 &&
    Object.values(tokens).every((values) => values[column] !== null)
  )
}

/** The CSS custom property a token is read from, e.g. `--zd-bg-neutral-primary`. */
export function themeTokenVar(name: ThemeTokenName): `--zd-${ThemeTokenName}` {
  return `--zd-${name}`
}

/** The role prefix of a token name. */
export function themeTokenRole(name: ThemeTokenName): TokenRole {
  return name.slice(0, name.indexOf('-')) as TokenRole
}
