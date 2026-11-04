import type { ThemeValues, ThemeVariant } from '../src/theme/tokens'

export function renderVariantDeclarations(
  variant: Pick<ThemeVariant, 'mode' | 'brand'>,
  tokens?: Record<string, ThemeValues>,
): string
export function renderTokensCss(tokens?: Record<string, ThemeValues>): string
