import { anvil, arbitrum, arbitrumSepolia, mainnet, sepolia } from "wagmi/chains";

/**
 * Single source of truth for the wallet setup, shared by `wagmi-config.tsx`,
 * the `/environment` diagnostics page and the `/config` URL builder.
 *
 * Kept in a plain module (no `"use client"`) precisely so server-rendered pages
 * can import it. Importing `wagmi-config.tsx` directly would not work — Next
 * turns every export of a client module into an opaque client reference on the
 * server, and it would run `createConfig()` server-side as a side effect.
 */

/**
 * Every chain selectable via `?chains=`. Not an SDK constraint — `wallet-core`
 * has no whitelist — but the ZeroDev project and bundler must support whatever
 * is picked, so an open-ended list would just fail at runtime.
 */
export const CHAIN_CATALOG = [
  arbitrumSepolia,
  sepolia,
  arbitrum,
  mainnet,
  anvil,
] as const;

/** The selection used when `?chains=` is absent. */
export const SUPPORTED_CHAINS = [arbitrumSepolia, sepolia] as const;

/**
 * Defaults for anything overridable via URL params (see `config-params.ts`).
 * These are what the app runs with when no params are present.
 */
export const DEFAULT_AUTH_METHODS = ["email", "google", "passkey"] as const;

export const DEFAULT_EMAIL_AUTH_METHOD = "otp" as const;

/**
 * Per-chain RPC overrides from the environment. Only the two original testnets
 * have env vars; every other chain falls through to `defaultTransportUrl`.
 */
export const RPC_URLS: Record<number, string | undefined> = {
  [arbitrumSepolia.id]: process.env.NEXT_PUBLIC_ARB_SEPOLIA_RPC_URL,
  [sepolia.id]: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
};

const ZERODEV_STAGING_RPC_BASE = "https://staging-rpc.zerodev.app/api/v3";

/** Anvil runs locally, so it can't route through a hosted RPC. */
export const ANVIL_RPC_URL = "http://localhost:18545";

/**
 * The transport a chain gets when nothing more specific is set.
 *
 * Everything routes through the ZeroDev staging RPC, keyed by project id and
 * chain — matching the shape the SDK itself builds in
 * `packages/react/src/utils/aaUtils.ts` (`/api/v3/<projectId>/chain/<chainId>`).
 * Anvil is the exception: it's a local node.
 *
 * Returns undefined when the project id is unset, which leaves `http()` to fall
 * back to viem's public RPC for the chain rather than building a broken URL.
 */
export function defaultTransportUrl(chainId: number): string | undefined {
  if (chainId === anvil.id) return ANVIL_RPC_URL;

  const projectId = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID;
  if (!projectId) return undefined;

  return `${ZERODEV_STAGING_RPC_BASE}/${projectId}/chain/${chainId}`;
}

/** Where a chain's transport comes from, before any URL param is applied. */
export function envTransportUrl(chainId: number): string | undefined {
  return RPC_URLS[chainId] ?? defaultTransportUrl(chainId);
}
