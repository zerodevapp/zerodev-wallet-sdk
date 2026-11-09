"use client";

import {
  ConnectWallet,
  isCancellationError,
  type KitAdapter,
  type KitNamespace,
  SignUp,
  useZeroDevWalletKit,
} from "@zerodev/wallet-react-ui";
import { ZeroDevLogo } from "@zerodev/react-ui";
import { Fragment, useState } from "react";
import { useAuthPreset } from "../lib/use-auth-preset";
import { useConfigHref, useResolvedConfig } from "../lib/use-wallet-config";
import { type AuthUnitId, resolveAuthUnits } from "../lib/wallet-config";
import { type DisconnectChoice, DisconnectDialog } from "./DisconnectDialog";

/**
 * Connector state and the actions that change it, above the auth gate as well
 * as below it.
 *
 * Connecting is driven from here rather than from a sign-in surface on the root
 * route, so a namespace can be connected on its own, one after another, or both
 * at once — and so a second connect while one is in flight is reachable at all.
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

const UNIT_BY_ID: Record<AuthUnitId, () => React.ReactNode> = {
  passkey: () => <SignUp.Passkey />,
  google: () => <SignUp.Google />,
  email: () => <SignUp.Email />,
  divider: () => <SignUp.Divider />,
  "wallet:metamask": () => <SignUp.Wallet walletId="metamask" />,
  "wallet:okx": () => <SignUp.Wallet walletId="okx" />,
  installedWallets: () => <SignUp.InstalledWallets />,
  moreWallets: () => <SignUp.MoreWallets />,
  walletConnect: () => <SignUp.WalletConnect />,
  solanaDivider: () => <SignUp.Divider label="Solana" />,
  installedWalletsMultichain: () => (
    <SignUp.InstalledWallets namespaces={["eip155", "solana"]} />
  ),
  installedWalletsSolana: () => (
    <SignUp.InstalledWallets namespaces={["solana"]} />
  ),
  solanaWalletConnect: () => <SignUp.SolanaWalletConnect />,
};

const ACTION_CLASS =
  "cursor-pointer rounded-full border border-[var(--border-warm)] bg-white px-3 py-1 text-[11px] font-semibold text-[#423a32] transition-colors hover:bg-[var(--surface-warm)] disabled:cursor-not-allowed disabled:opacity-40";

/** What the last host-driven `connect()` rejected with. */
type ConnectFailure = {
  namespace: KitNamespace | "all";
  /** `AuthFlowDismissedError` when the sheet was closed before connecting. */
  name: string;
  message: string;
  /** Whether the SDK classifies it as a cancellation rather than a failure. */
  cancellation: boolean;
};

function NamespaceRow({ adapter }: { adapter: KitAdapter<KitNamespace> }) {
  const { namespace, status, address, walletInfo, wallets, walletConnect } =
    adapter;

  return (
    <div
      className="flex min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-1"
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

      <span className="text-[11px] text-[#9c958c]">
        {wallets.length} detected{walletConnect ? " · WC" : ""}
      </span>
    </div>
  );
}

export function ConnectorStatus() {
  const { solanaEnabled, namespaces, emailAuthMethod } = useResolvedConfig();
  const { preset } = useAuthPreset();
  const configHref = useConfigHref();
  // This strip renders on every page, signed in or not, so it owns the Solana
  // restore for the app. Other kit callers pass `reconnectOnMount: false`.
  const kit = useZeroDevWalletKit({ reconnectOnMount: solanaEnabled });

  const [failure, setFailure] = useState<ConnectFailure | null>(null);
  const [showDisconnectChoice, setDisconnectChoice] = useState(false);
  const [disconnecting, setDisconnecting] = useState<DisconnectChoice | null>(
    null,
  );

  const record = (namespace: ConnectFailure["namespace"], error: unknown) =>
    setFailure({
      namespace,
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      cancellation: isCancellationError(error),
    });

  const connect = async (namespace: KitNamespace) => {
    setFailure(null);
    try {
      await kit.connect({ namespace });
    } catch (error: unknown) {
      record(namespace, error);
    }
  };

  const connectAll = async () => {
    setFailure(null);
    for (const namespace of namespaces) {
      try {
        await kit.connect({ namespace });
      } catch (error: unknown) {
        record(namespace, error);
        return;
      }
    }
  };

  const needsDisconnectChoice =
    kit.solana.isConnected ||
    (kit.eip155.isConnected && kit.eip155.walletInfo?.source !== "embedded");

  const runDisconnect = async (choice: DisconnectChoice) => {
    setDisconnecting(choice);

    if (choice !== "all") {
      try {
        await kit.disconnect({ namespace: choice });
      } finally {
        setDisconnecting(null);
        setDisconnectChoice(false);
      }
      return;
    }

    try {
      await kit.disconnect();
    } finally {
      // Full load, keeping the active config: landing on a bare "/" would drop
      // any URL overrides and sign you back into a different setup.
      window.location.assign(configHref("/"));
    }
  };

  const handleLogout = () => {
    if (needsDisconnectChoice) {
      setDisconnectChoice(true);
      return;
    }
    void runDisconnect("all");
  };

  return (
    <>
      <DisconnectDialog
        isOpen={showDisconnectChoice}
        onClose={() => setDisconnectChoice(false)}
        onChoose={(choice) => void runDisconnect(choice)}
        evmConnected={kit.eip155.isConnected}
        solanaConnected={kit.solana.isConnected}
        busy={disconnecting}
      />

      <section
        className="border-b border-[var(--border-warm)] bg-[var(--surface-warm)] font-[var(--font-dm-sans)]"
        data-testid="connector-status"
        data-connected={String(kit.isConnected)}
        data-reconnecting={String(kit.isReconnecting)}
        aria-label="Connector status"
      >
        <div className="mx-auto flex w-full max-w-[1920px] flex-col items-center justify-center gap-2 px-4 py-2 sm:px-6 lg:px-9">
          <div className="flex flex-col items-center justify-center gap-2 lg:flex-row lg:gap-8">
            <NamespaceRow adapter={kit.eip155} />
            <NamespaceRow adapter={kit.solana} />
          </div>

          <div
            className="flex flex-wrap items-center justify-center gap-2"
            data-testid="connector-actions"
          >
            <button
              type="button"
              onClick={() => void connect("eip155")}
              disabled={kit.eip155.isConnected}
              data-testid="connector-connect-eip155"
              className={ACTION_CLASS}
            >
              Connect EVM
            </button>
            <button
              type="button"
              onClick={() => void connect("solana")}
              disabled={kit.solana.isConnected}
              data-testid="connector-connect-solana"
              className={ACTION_CLASS}
            >
              Connect Solana
            </button>
            <button
              type="button"
              onClick={() => void connectAll()}
              disabled={kit.eip155.isConnected && kit.solana.isConnected}
              data-testid="connector-connect-all"
              className={ACTION_CLASS}
            >
              Connect all
            </button>
            <button
              type="button"
              onClick={handleLogout}
              data-testid="wallet-logout"
              className={ACTION_CLASS}
            >
              Logout
            </button>

            {failure && (
              <p
                className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800"
                data-testid="connector-error"
                data-namespace={failure.namespace}
                data-error-name={failure.name}
                data-cancellation={String(failure.cancellation)}
                title={failure.message}
              >
                {failure.name}
                {failure.cancellation ? " · cancelled" : ""}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center p-4">
        <div className="pointer-events-auto" data-testid="connect-wallet">
          <ConnectWallet
            size="md"
            logo={
              <ZeroDevLogo
                variant="mark"
                tone="color"
                className="zd:h-8 zd:w-auto"
              />
            }
            renderSignUp={() => (
              <SignUp emailAuthMethod={emailAuthMethod}>
                {resolveAuthUnits(preset, namespaces).map((id) => (
                  <Fragment key={id}>{UNIT_BY_ID[id]()}</Fragment>
                ))}
              </SignUp>
            )}
          />
        </div>
      </div>
    </>
  );
}
