import type { CSSProperties } from 'react'
import {
  isThemeVariantComplete,
  type ThemeBrand,
  type ThemeMode,
  type ThemeTokenName,
  themeTokenVar,
} from './tokens'

/**
 * How a host picks a theme. A theme is a point on the design system's grid,
 * `mode` × `brand`, plus any token overrides on top:
 *
 * - `mode`: `light`, `dark`, or `system` to follow `prefers-color-scheme`.
 * - `brand`: `branded` keeps the ZeroDev look (gradient ring, card glow,
 *   brand orange); `plain` folds the brand onto neutrals and drops the art.
 * - `tokens`: per-token overrides, written as CSS custom properties on the
 *   surface, so they beat the preset and any stylesheet.
 *
 * The stylesheet does the switching: the preset writes `data-zd-mode` and
 * `data-zd-brand` on the surface, and `tokens.css` carries a block per
 * variant. A host that would rather not use React for this can set those two
 * attributes on any ancestor, or override the `--zd-*` properties from its
 * own stylesheet; a host rule on the surface beats the preset's block.
 */
export type ThemeModeSetting = ThemeMode | 'system'

export interface Theme {
  mode?: ThemeModeSetting | undefined
  brand?: ThemeBrand | undefined
  tokens?: ThemeTokenOverrides | undefined
}

/** Per-token overrides; an `undefined` entry is skipped, so a host can
 * pass conditional values without filtering them. */
export type ThemeTokenOverrides = Partial<
  Record<ThemeTokenName, string | undefined>
>

/** A preset by name, `<brand>-<mode>`. */
export type ThemeName = `${ThemeBrand}-${ThemeMode}`

export type ThemeInput = Theme | ThemeName

export interface ResolvedTheme {
  mode: ThemeModeSetting
  brand: ThemeBrand
  tokens: ThemeTokenOverrides
}

/** The four presets. Spread one and add `tokens` to start from it. */
export const themes = {
  brandedLight: { mode: 'light', brand: 'branded' },
  plainLight: { mode: 'light', brand: 'plain' },
  brandedDark: { mode: 'dark', brand: 'branded' },
  plainDark: { mode: 'dark', brand: 'plain' },
} as const satisfies Record<string, Theme>

/** The default: today's look, branded light. */
export const DEFAULT_THEME: ResolvedTheme = {
  mode: 'light',
  brand: 'branded',
  tokens: {},
}

export function resolveTheme(input: ThemeInput): ResolvedTheme {
  if (typeof input === 'string') {
    const [brand, mode] = input.split('-') as [ThemeBrand, ThemeMode]
    return { mode, brand, tokens: {} }
  }
  return {
    mode: input.mode ?? DEFAULT_THEME.mode,
    brand: input.brand ?? DEFAULT_THEME.brand,
    tokens: input.tokens ?? {},
  }
}

/**
 * Whether the stylesheet carries the theme's variant. `system` is available
 * when its light half is; a dark half still missing leaves the light values
 * in place under a dark scheme.
 */
export function isThemeAvailable(theme: ResolvedTheme): boolean {
  const mode = theme.mode === 'system' ? 'light' : theme.mode
  return isThemeVariantComplete(mode, theme.brand)
}

/** The attributes the stylesheet keys its variant blocks on. */
export function themeAttributes(theme: ResolvedTheme): {
  'data-zd-mode': ThemeModeSetting
  'data-zd-brand': ThemeBrand
} {
  return { 'data-zd-mode': theme.mode, 'data-zd-brand': theme.brand }
}

/** The token overrides as inline custom properties. */
export function themeStyle(theme: ResolvedTheme): CSSProperties {
  const style: Record<string, string> = {}
  for (const [name, value] of Object.entries(theme.tokens)) {
    if (value !== undefined)
      style[themeTokenVar(name as ThemeTokenName)] = value
  }
  return style as CSSProperties
}

/**
 * Write the theme onto a DOM element (attributes and token overrides) and
 * return the undo. For elements React does not render, such as the portal
 * root that tooltips and sheets land in.
 */
export function applyThemeToElement(
  element: HTMLElement,
  theme: ResolvedTheme,
): () => void {
  const attributes = themeAttributes(theme)
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value)
  }
  const properties = Object.keys(themeStyle(theme))
  for (const property of properties) {
    element.style.setProperty(
      property,
      theme.tokens[property.slice(5) as ThemeTokenName] ?? '',
    )
  }
  return () => {
    for (const name of Object.keys(attributes)) element.removeAttribute(name)
    for (const property of properties) element.style.removeProperty(property)
  }
}
