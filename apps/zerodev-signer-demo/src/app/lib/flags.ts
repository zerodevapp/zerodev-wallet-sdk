/**
 * Solana support in the kit is pre-release, so the demo keeps every Solana
 * surface (sign-in option, dashboard rows, signing button) off unless
 * `NEXT_PUBLIC_SOLANA_ENABLED=true`. Next inlines the variable at build
 * time, so this is a constant: safe to branch on in render, and a change
 * needs a dev-server restart.
 */
export const SOLANA_ENABLED = process.env.NEXT_PUBLIC_SOLANA_ENABLED === 'true'
