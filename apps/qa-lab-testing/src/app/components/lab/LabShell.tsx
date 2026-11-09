"use client";

import { useZeroDevWalletKit } from "@zerodev/wallet-react-ui";
import { AppHeader } from "../AppHeader";
import { ConnectorStatus } from "../ConnectorStatus";
import { LoginScreen } from "../LoginScreen";
import { LabSidebar } from "./LabSidebar";
import { WalletStrip } from "./WalletStrip";

/**
 * Chrome and auth gate for every lab route.
 *
 * The gate lives here rather than in each page so a new feature can't ship
 * ungated by forgetting to add it — dropping a page under `(lab)/` is enough.
 *
 * Keyed off `isConnected` alone, never wagmi's `status`. With the zeroDevWallet
 * connector `connecting` is not transient: `connect()` stays pending while the
 * user works through the ConnectWallet, so hiding the login surface during it
 * unmounts the very UI that would resolve the connection and the page hangs.
 * Loading treatment belongs inside LoginScreen, which keys off the auth step.
 */
export function LabShell({ children }: { children: React.ReactNode }) {
  const kit = useZeroDevWalletKit({ reconnectOnMount: false });
  const signedIn = kit.isConnected || kit.isReconnecting;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <ConnectorStatus />

      {signedIn ? (
        <>
          {/*
            Full width, above the nav, at every breakpoint. It sits outside the
            content column so mobile gets wallet-then-nav without a second
            WalletStrip — two instances would mean two sets of state and two
            balance polls hitting the RPC every 10s.
          */}
          <WalletStrip />

          <div className="flex flex-col lg:flex-row">
            <LabSidebar />
            <main className="min-w-0 flex-1" data-testid="lab-main">
              <div className="px-4 py-4 sm:px-6 sm:py-6">{children}</div>
            </main>
          </div>
        </>
      ) : (
        <LoginScreen />
      )}
    </div>
  );
}
