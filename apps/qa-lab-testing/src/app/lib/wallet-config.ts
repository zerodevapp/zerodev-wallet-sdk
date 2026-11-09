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
 * The chains the lab runs on, and the only place to change them.
 *
 * `CHAINS[0]` is wagmi's active chain. **Sepolia leads because some external
 * wallets do not carry Arbitrum Sepolia**, and a default chain the wallet has
 * never heard of turns a connect test into a chain-switching test.
 *
 * Every entry must be enabled on the ZeroDev project and its bundler. Nothing
 * validates that and `wallet-core` has no whitelist so an unsupported chain
 * fails at runtime. Both testnets carry every test contract
 * (`testing-lab/contracts.ts`).
 */
export const CHAINS = [
  sepolia,
  arbitrumSepolia,
  mainnet,
  arbitrum,
  anvil,
] as const;

/**
 * Every sign-in unit a preset can be built from, with its UI label. Ids rather
 * than components, so this module stays server-importable; the JSX lives in
 * `LoginScreen` → `UNIT_BY_ID`, typed against `AuthUnitId` so an unwired id is
 * a type error.
 */
export const AUTH_UNITS = {
  passkey: "Passkey",
  google: "Google",
  email: "Email",
  divider: 'Separator ("or")',
  "wallet:metamask": "MetaMask, pinned row",
  "wallet:okx": "OKX Wallet, pinned row",
  installedWallets: "Installed wallets, auto-detected (EIP-6963)",
  moreWallets: "More wallets, opens the full grid",
  walletConnect: "WalletConnect, QR pairing",
  solanaDivider: 'Separator ("Solana")',
  installedWalletsMultichain:
    "Installed wallets, EVM + Solana merged by name (one row per wallet)",
  installedWalletsSolana: "Installed wallets, Solana only (Wallet Standard)",
  solanaWalletConnect: "WalletConnect for Solana, QR pairing",
} as const;

/**
 * Chain families the sign-in surface can offer, in render order.
 */
export const AUTH_NAMESPACES = [
  { id: "eip155", label: "EVM" },
  { id: "solana", label: "Solana" },
] as const;

export type AuthNamespace = (typeof AUTH_NAMESPACES)[number]["id"];

export const AUTH_NAMESPACE_IDS = AUTH_NAMESPACES.map(
  (n) => n.id,
) as AuthNamespace[];

export const isAuthNamespace = (value: string): value is AuthNamespace =>
  (AUTH_NAMESPACE_IDS as readonly string[]).includes(value);

/** What the surface offers when `?ns=` says nothing. */
export const defaultNamespaces = (
  solanaEnabled: boolean,
): readonly AuthNamespace[] =>
  solanaEnabled ? ["eip155", "solana"] : ["eip155"];

export type AuthUnitId = keyof typeof AUTH_UNITS;

/**
 * Sign-in surfaces, as a closed set of named presets rather than free-form
 * toggles.
 *
 * `units` **is** the render order, not a description of it: `LoginScreen` maps
 * over this array and `/config` lists it, so the page cannot advertise a
 * surface you do not get.
 */
export const AUTH_PRESETS = {
  "preset-1": {
    label: "Embedded wallet",
    description:
      "The ZeroDev embedded wallet. What the lab has always defaulted to.",
    units: ["passkey", "google", "email"],
  },
  "preset-2": {
    label: "External wallets",
    description:
      "External wallets only, with no embedded-wallet method — so the wallet paths can be exercised on their own.",
    units: [
      "wallet:okx",
      "divider",
      "installedWallets",
      "moreWallets",
      "walletConnect",
    ],
  },
} as const satisfies Record<
  string,
  {
    label: string;
    description: string;
    units: readonly AuthUnitId[];
  }
>;

export type AuthPresetId = keyof typeof AUTH_PRESETS;

export const AUTH_PRESET_IDS = Object.keys(AUTH_PRESETS) as AuthPresetId[];

export const DEFAULT_AUTH_PRESET: AuthPresetId = "preset-1";

export const isAuthPresetId = (value: string): value is AuthPresetId =>
  (AUTH_PRESET_IDS as readonly string[]).includes(value);

/**
 * The units that actually render: the preset, plus the Solana surface when it
 * is switched on.
 *
 * `LoginScreen` and `/config` both go through this rather than reading
 * `AUTH_PRESETS[id].units` directly, for the same reason `units` is the render
 * order: the config page must not advertise a surface you do not get.
 *
 * Solana applies to any preset, including the embedded one — the flag means
 * "offer Solana here", and which preset you are on is a separate axis.
 */
export function resolveAuthUnits(
  preset: AuthPresetId,
  namespaces: readonly AuthNamespace[],
): readonly AuthUnitId[] {
  const units = AUTH_PRESETS[preset].units;
  const withEvm = namespaces.includes("eip155");
  const withSolana = namespaces.includes("solana");

  if (!withSolana) return units;

  // Solana only: drop the EVM surfaces outright rather than leaving rows that
  // cannot connect anything.
  if (!withEvm) {
    const kept = units.filter(
      (unit) =>
        unit !== "installedWallets" &&
        unit !== "moreWallets" &&
        unit !== "walletConnect" &&
        !unit.startsWith("wallet:"),
    );
    const solanaSurface: readonly AuthUnitId[] = [
      "installedWalletsSolana",
      "solanaWalletConnect",
    ];
    // A preset that still has embedded methods keeps them, behind a divider.
    return kept.length > 0
      ? [...kept, "solanaDivider", ...solanaSurface]
      : solanaSurface;
  }

  // Both: swap the EVM-only list for the merged one rather than adding a
  // second, Solana-only list. The kit merges by name — a wallet installed for
  // both chains is one row that asks which to connect — so two lists would
  // split MetaMask and Phantom apart instead of showing each once.
  const swapped = units.map((unit): AuthUnitId =>
    unit === "installedWallets" ? "installedWalletsMultichain" : unit,
  );

  if (swapped.includes("installedWalletsMultichain")) {
    return [...swapped, "solanaWalletConnect"];
  }

  // A preset with no wallet list at all (the embedded one): add the Solana
  // surface behind a divider rather than running it on from the email field.
  return [
    ...swapped,
    "solanaDivider",
    "installedWalletsMultichain",
    "solanaWalletConnect",
  ];
}

/**
 * Where the active preset persists. Namespaced so it can't collide with the
 * SDK's own keys, which share this origin.
 */
export const AUTH_PRESET_STORAGE_KEY = "qa-lab:auth-preset";

/**
 * Reown Cloud project id. Set → the WalletConnect connector registers and
 * preset 2's wallet rows work; unset → they render but can't pair.
 */
export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const ZERODEV_STAGING_RPC_BASE = "https://staging-rpc.zerodev.app/api/v3";

export const ANVIL_CHAIN_ID = anvil.id;

/** Anvil runs locally, so it can't route through a hosted RPC. */
export const ANVIL_RPC_URL =
  process.env.NEXT_PUBLIC_ANVIL_URL || "http://localhost:18545";

/** The magic-link-configured project id. */
export const MAGIC_LINK_PROJECT_ID = process.env.NEXT_PUBLIC_ZD_PROJECT_ID;

/** The OTP-configured project id. */
export const OTP_PROJECT_ID = process.env.NEXT_PUBLIC_ZD_OTP_PROJECT_ID;

/**
 * Authentication flavors available in the app.
 */
export const AUTH_FLAVORS = {
  magicLink: { projectId: MAGIC_LINK_PROJECT_ID, emailAuthMethod: "magicLink" },
  otp: { projectId: OTP_PROJECT_ID, emailAuthMethod: "otp" },
} as const;

export type AuthFlavorId = keyof typeof AUTH_FLAVORS;

export const AUTH_FLAVOR_IDS = Object.keys(AUTH_FLAVORS) as AuthFlavorId[];

/**
 * Magic link is the default because a magic-link email lands on `/verify` with
 * whatever URL the project's template produced — it can't carry `?authFlavor`.
 * So the flavor that has to work without params is this one.
 */
export const DEFAULT_AUTH_FLAVOR: AuthFlavorId = "magicLink";

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
export function defaultTransportUrl(
  chainId: number,
  projectId: string | undefined,
): string | undefined {
  if (chainId === anvil.id) return ANVIL_RPC_URL;
  if (!projectId) return undefined;

  return `${ZERODEV_STAGING_RPC_BASE}/${projectId}/chain/${chainId}`;
}

