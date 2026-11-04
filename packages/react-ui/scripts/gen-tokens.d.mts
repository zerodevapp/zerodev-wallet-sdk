import type { ThemeValues, ThemeVariant } from '../src/theme/tokens'

export function renderVariantDeclarations(
  variant: Pick<ThemeVariant, 'mode' | 'brand'>,
  tokens?: Record<string, ThemeValues>,
  indent?: string,
): string
export function completeVariants(
  tokens?: Record<string, ThemeValues>,
): ThemeVariant[]
export function renderVariantBlock(
  variant: Pick<ThemeVariant, 'mode' | 'brand'>,
  tokens?: Record<string, ThemeValues>,
  options?: { modeAttribute?: string; indent?: string },
): string
export function renderVariantBlocks(tokens?: Record<string, ThemeValues>): string
export function renderTokensCss(tokens?: Record<string, ThemeValues>): string
