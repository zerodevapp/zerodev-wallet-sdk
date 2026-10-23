"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useAccount } from "wagmi";
import { AppHeader } from "../AppHeader";
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
  const { isConnected, address } = useAccount();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (isLoggingOut) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-[#9c958c]" />
          <span className="text-sm text-[var(--muted)]">Signing out...</span>
        </div>
      </div>
    );
  }

  if (!isConnected || !address) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen">
      <AppHeader />

      {/*
        Full width, above the nav, at every breakpoint. It sits outside the
        content column so mobile gets wallet-then-nav without a second
        WalletStrip — two instances would mean two sets of state and two
        balance polls hitting the RPC every 10s.
      */}
      <WalletStrip onLogout={() => setIsLoggingOut(true)} />

      <div className="flex flex-col lg:flex-row">
        <LabSidebar />
        <main className="min-w-0 flex-1" data-testid="lab-main">
          <div className="px-4 py-4 sm:px-6 sm:py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
