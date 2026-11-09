"use client";

import {
  type KitAdapter,
  type KitNamespace,
  useZeroDevWalletKit,
} from "@zerodev/wallet-react-ui";
import { useResolvedConfig } from "../lib/use-wallet-config";

/**
 * Per-namespace connector state, read straight off the kit.
 *
 * Rendered above the auth gate as well as below it, so a namespace can be
 * asserted while it is disconnected or connecting — a Solana-only session
 * leaves the EVM side disconnected, and that absence is the assertion.
 */

const NAMESPACE_LABELS: Record<KitNamespace, string> = {
  eip155: "EVM",
  solana: "Solana",
};

const STATUS_STYLES: Record<string, string> = {
  connected: "border-emerald-200 bg-emerald-50 text-emerald-700",
  connecting: "border-amber-200 bg-amber-50 text-amber-700",
  reconnecting: "border-amber-200 bg-amber-50 text-amber-700",
  disconnected: "border-[var(--border-warm)] bg-white text-[#9c958c]",
};

function NamespaceRow({ adapter }: { adapter: KitAdapter<KitNamespace> }) {
  const { namespace, status, address, walletInfo, wallets, walletConnect } =
    adapter;

  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1"
      data-testid={`connector-${namespace}`}
      data-namespace={namespace}
      data-status={status}
      data-connected={String(adapter.isConnected)}
      data-reconnecting={String(adapter.isReconnecting)}
      data-address={address ?? ""}
      data-wallet={walletInfo?.name ?? ""}
      data-wallet-source={walletInfo?.source ?? ""}
      data-wallets={wallets.map((w) => w.name).join(",")}
      data-wallets-count={wallets.length}
      data-walletconnect={String(walletConnect)}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9c958c]">
        {NAMESPACE_LABELS[namespace]}
      </span>

      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
          STATUS_STYLES[status] ?? STATUS_STYLES.disconnected
        }`}
      >
        {status}
      </span>

      {walletInfo?.name && (
        <span className="text-[11px] font-semibold text-[#423a32]">
          {walletInfo.name}
        </span>
      )}

      {/* Full value, never shortened: a QA tool exists to be copied out of. */}
      {address && (
        <span className="break-all font-[var(--font-geist-mono)] text-[11px] text-[var(--muted)]">
          {address}
        </span>
      )}

      <span className="text-[11px] text-[#9c958c]">
        {wallets.length} detected{walletConnect ? " · WC" : ""}
      </span>
    </div>
  );
}

export function ConnectorStatus() {
  const { solanaEnabled } = useResolvedConfig();
  // This strip renders on every page, signed in or not, so it owns the Solana
  // restore for the app. Other kit callers pass `reconnectOnMount: false` to
  // avoid running a second one.
  const kit = useZeroDevWalletKit({ reconnectOnMount: solanaEnabled });

  return (
    <section
      className="border-b border-[var(--border-warm)] bg-[var(--surface-warm)] font-[var(--font-dm-sans)]"
      data-testid="connector-status"
      data-connected={String(kit.isConnected)}
      data-reconnecting={String(kit.isReconnecting)}
      aria-label="Connector status"
    >
      <div className="mx-auto flex w-full max-w-[1920px] flex-col gap-2 px-4 py-2 sm:px-6 lg:flex-row lg:items-center lg:gap-8 lg:px-9">
        <NamespaceRow adapter={kit.eip155} />
        <NamespaceRow adapter={kit.solana} />
      </div>
    </section>
  );
}
