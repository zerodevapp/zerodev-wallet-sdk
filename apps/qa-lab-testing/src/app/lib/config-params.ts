import type { Chain } from "viem";
import {
  ANVIL_CHAIN_ID,
  AUTH_FLAVOR_IDS,
  AUTH_FLAVORS,
  type AuthFlavorId,
  type AuthPresetId,
  CHAINS,
  DEFAULT_AUTH_FLAVOR,
  defaultTransportUrl,
  isAuthPresetId,
} from "./wallet-config";

/**
 * Resolves the wallet config for a request, from the URL and the environment
 * only. Server-safe and storage-free.
 *
 * URL params carry anything the connector is built from, so the server resolves
 * exactly what the client resolves. The one persisted value, the auth preset,
 * lives in `use-auth-preset.ts` which is safe there because it never reaches the
 * connector.
 */

export const EMAIL_AUTH_METHODS = ["otp", "magicLink"] as const;
export type EmailAuthMethodId = (typeof EMAIL_AUTH_METHODS)[number];

export { CHAINS } from "./wallet-config";

/** Where a chain's transport URL came from, for the diagnostics page. */
export type TransportSource = "param" | "default" | "local" | "chain";

export const PARAM = {
  preset: "preset",
  authFlavor: "authFlavor",
  /** Per-chain transport, e.g. `rpc.421614`. */
  rpcPrefix: "rpc.",
} as const;

/**
 * Retired params, recognised only to warn. A stale URL or spec would otherwise
 * run against defaults while looking like it tested an override.
 */
const RETIRED_PARAMS: Record<string, string> = {
  kms: "set NEXT_PUBLIC_KMS_PROXY_BASE_URL in .env instead",
  aaHost: "set NEXT_PUBLIC_ZERODEV_AA_HOST in .env instead",
  chains: "edit CHAINS in lib/wallet-config.ts instead",
  authMethods: "use ?preset=preset-1 | preset-2 instead",
};

/** Every param this module owns; used to carry config across navigation. */
export const isConfigParam = (key: string) =>
  key === PARAM.preset ||
  key === PARAM.authFlavor ||
  key.startsWith(PARAM.rpcPrefix);

export interface ResolvedWalletConfig {
  kmsProxyBaseUrl: string | undefined;
  aaHost: string | undefined;
  chains: readonly [Chain, ...Chain[]];
  rpcUrls: Record<number, string | undefined>;
  /** Provenance per chain, so `/environment` can show where a transport came from. */
  rpcSources: Record<number, TransportSource>;
  /**
   * The preset named by `?preset=`. Undefined means the URL said nothing, NOT
   * the default — a stored preset may win, which only the client can see.
   */
  authPreset: AuthPresetId | undefined;
  /** Selected delivery flavor; binds projectId and emailAuthMethod together. */
  authFlavor: AuthFlavorId;
  /** The ZeroDev project the connector authenticates against. */
  projectId: string | undefined;
  emailAuthMethod: EmailAuthMethodId;
  /** Params that were present and applied — drives the "overridden" badge. */
  applied: string[];
  /** Params that were present but rejected. Never fail silently. */
  warnings: string[];
}

const ENV = {
  kms: process.env.NEXT_PUBLIC_KMS_PROXY_BASE_URL,
  aaHost: process.env.NEXT_PUBLIC_ZERODEV_AA_HOST,
};

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Resolves the effective wallet config from query params, falling back to
 * `wallet-config.ts` for anything absent or invalid.
 *
 * Validation lives here, not only in the builder form, because URLs get
 * hand-edited.
 */
export function resolveWalletConfig(
  params?: URLSearchParams | null,
): ResolvedWalletConfig {
  const applied: string[] = [];
  const warnings: string[] = [];
  const get = (key: string) => params?.get(key)?.trim() || undefined;

  for (const [key, advice] of Object.entries(RETIRED_PARAMS)) {
    if (get(key) !== undefined) {
      warnings.push(`${key}: no longer supported — ${advice}.`);
    }
  }

  // Environment only, resolved here so the connector has one source.
  const kmsProxyBaseUrl = ENV.kms;
  const aaHost = ENV.aaHost;

  // Not overridable; edit CHAINS.
  const chains = CHAINS as unknown as readonly [Chain, ...Chain[]];

  // Delivery flavor. Resolved before transports because it decides the project
  // id, and the default RPC URL is scoped to that project.
  let authFlavor: AuthFlavorId = DEFAULT_AUTH_FLAVOR;
  const rawFlavor = get(PARAM.authFlavor);
  if (rawFlavor !== undefined) {
    if ((AUTH_FLAVOR_IDS as readonly string[]).includes(rawFlavor)) {
      authFlavor = rawFlavor as AuthFlavorId;
      applied.push(PARAM.authFlavor);
    } else {
      warnings.push(
        `${PARAM.authFlavor}: "${rawFlavor}" must be one of ${AUTH_FLAVOR_IDS.join(" | ")} — using default.`,
      );
    }
  }

  const { projectId, emailAuthMethod } = AUTH_FLAVORS[authFlavor];
  if (!projectId) {
    warnings.push(
      `${PARAM.authFlavor}: the "${authFlavor}" project id is not set — auth will fail.`,
    );
  }

  // Transports, one lookup per selected chain. Precedence: URL param, then the
  // ZeroDev staging RPC scoped to the active project (localhost for Anvil). Only
  // if both are absent does `http(undefined)` fall back to viem's public RPC.
  const rpcUrls: Record<number, string | undefined> = {};
  const rpcSources: Record<number, TransportSource> = {};

  const fallbackTransport = (chainId: number) => {
    const url = defaultTransportUrl(chainId, projectId);
    rpcUrls[chainId] = url;

    if (chainId === ANVIL_CHAIN_ID) rpcSources[chainId] = "local";
    else if (url) rpcSources[chainId] = "default";
    else rpcSources[chainId] = "chain";
  };

  for (const chain of chains) {
    const key = `${PARAM.rpcPrefix}${chain.id}`;
    const raw = get(key);
    if (raw === undefined) {
      fallbackTransport(chain.id);
      continue;
    }
    if (!isHttpUrl(raw)) {
      warnings.push(`${key}: "${raw}" is not an http(s) URL — using default.`);
      fallbackTransport(chain.id);
      continue;
    }
    rpcUrls[chain.id] = raw;
    rpcSources[chain.id] = "param";
    applied.push(key);
  }

  // An rpc.* for a chain that isn't selected is almost always a mistake.
  params?.forEach((_value, key) => {
    if (!key.startsWith(PARAM.rpcPrefix)) return;
    const id = key.slice(PARAM.rpcPrefix.length);
    if (!chains.some((chain) => String(chain.id) === id)) {
      warnings.push(`${key}: chain ${id} is not selected — ignored.`);
    }
  });

  // Auth preset. Left undefined when absent rather than defaulted, because a
  // stored preset outranks the default and only the client can read storage.
  let authPreset: AuthPresetId | undefined;
  const rawPreset = get(PARAM.preset);
  if (rawPreset !== undefined) {
    if (isAuthPresetId(rawPreset)) {
      authPreset = rawPreset;
      applied.push(PARAM.preset);
    } else {
      warnings.push(
        `${PARAM.preset}: unknown preset "${rawPreset}" — using the stored or default preset.`,
      );
    }
  }

  return {
    kmsProxyBaseUrl,
    aaHost,
    chains,
    rpcUrls,
    rpcSources,
    authPreset,
    authFlavor,
    projectId,
    emailAuthMethod,
    applied,
    warnings,
  };
}

/**
 * Keeps only the config params from a query string. Used to carry the active
 * config across in-app navigation — a link that drops these silently reverts to
 * defaults, which also logs the user out.
 */
export function pickConfigParams(
  params?: URLSearchParams | null,
): URLSearchParams {
  const picked = new URLSearchParams();
  params?.forEach((value, key) => {
    if (isConfigParam(key)) picked.append(key, value);
  });
  return picked;
}

/** `?a=b` or `""` — safe to append to any href. */
export function configQuerySuffix(params?: URLSearchParams | null): string {
  const query = pickConfigParams(params).toString();
  return query ? `?${query}` : "";
}

/** Appends the active config to an internal href. */
export function withConfig(
  href: string,
  params?: URLSearchParams | null,
): string {
  const suffix = configQuerySuffix(params);
  if (!suffix) return href;
  return href.includes("?") ? `${href}&${suffix.slice(1)}` : `${href}${suffix}`;
}

/**
 * Next hands server components `searchParams` as a plain record; normalise it
 * so server and client share one resolver.
 */
export function toURLSearchParams(
  record: Record<string, string | string[] | undefined> | undefined,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record ?? {})) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else params.append(key, value);
  }
  return params;
}

/**
 * Builder output: only non-default values become params.
 *
 * The preset is always emitted, even at its default. A bare URL means
 * "whatever is stored", so `?preset=preset-1` is the only way to write a link
 * that reliably lands on preset 1.
 */
export function serializeOverrides(overrides: {
  rpcUrls?: Record<number, string>;
  preset?: AuthPresetId;
  authFlavor?: AuthFlavorId;
}): URLSearchParams {
  const params = new URLSearchParams();

  if (overrides.preset) {
    params.set(PARAM.preset, overrides.preset);
  }
  const activeProjectId =
    AUTH_FLAVORS[overrides.authFlavor ?? DEFAULT_AUTH_FLAVOR].projectId;
  for (const [id, url] of Object.entries(overrides.rpcUrls ?? {})) {
    const chainId = Number(id);
    if (url && url !== defaultTransportUrl(chainId, activeProjectId)) {
      params.set(`${PARAM.rpcPrefix}${chainId}`, url);
    }
  }
  if (overrides.authFlavor && overrides.authFlavor !== DEFAULT_AUTH_FLAVOR) {
    params.set(PARAM.authFlavor, overrides.authFlavor);
  }

  return params;
}
