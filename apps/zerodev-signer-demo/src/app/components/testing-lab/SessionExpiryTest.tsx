"use client";

import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { cn } from "../../lib/utils";

// The connector exposes a custom `getStore()` returning the SDK's zustand
// store (not part of wagmi's Connector type — hence the cast).
type SdkStore = {
  getState: () => { clear: () => void; session: unknown; eoaAccount: unknown };
};
type ConnectorWithStore = { getStore?: () => Promise<SdkStore> };

const shortAddress = (value?: string) =>
  value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "—";

/**
 * Test Case — reproduces the post-session-expiry "weird state" instantly by
 * calling the SDK store's `clear()` — exactly what the auto-refresh failure
 * path does (`provider.ts:131`). It clears the SDK's session WITHOUT emitting a
 * wagmi `disconnect`, so wagmi stays stale-`connected`. Both states are shown
 * side by side so the divergence is visible after clearing.
 */
export function SessionExpiryTest() {
  const { address, status, chainId, connector } = useAccount();
  const [sdkSession, setSdkSession] = useState<"present" | "cleared" | "unknown">(
    "unknown",
  );
  const [cleared, setCleared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readSdk = useCallback(async () => {
    try {
      const store = await (connector as unknown as ConnectorWithStore)?.getStore?.();
      if (!store) return setSdkSession("unknown");
      const state = store.getState();
      setSdkSession(state.session || state.eoaAccount ? "present" : "cleared");
    } catch {
      setSdkSession("unknown");
    }
  }, [connector]);

  useEffect(() => {
    void readSdk();
  }, [readSdk]);

  const handleSimulate = async () => {
    setError(null);
    try {
      const store = await (connector as unknown as ConnectorWithStore)?.getStore?.();
      if (!store) {
        setError("Connector store unavailable");
        return;
      }
      store.getState().clear();
      setCleared(true);
      await readSdk();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear session");
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
      <h3 className="text-base font-semibold text-gray-900">
        Simulate session expiry
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        Clears the SDK session (what the auto-refresh failure path does) without
        notifying wagmi. After clearing, the SDK store goes empty but wagmi stays
        connected — the divergence that leaves the app in the weird state.
      </p>

      {/* State comparison */}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
          <p className="mb-1.5 text-xs font-semibold text-gray-500">
            wagmi (useAccount)
          </p>
          <dl className="space-y-0.5 font-mono text-[11px] text-gray-700">
            <div className="flex justify-between gap-2">
              <dt className="text-gray-400">status</dt>
              <dd
                className={cn(
                  "font-semibold",
                  status === "connected" ? "text-emerald-700" : "text-gray-700",
                )}
              >
                {status}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-400">address</dt>
              <dd title={address}>{shortAddress(address)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-400">chainId</dt>
              <dd>{chainId ?? "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
          <p className="mb-1.5 text-xs font-semibold text-gray-500">SDK store</p>
          <dl className="space-y-0.5 font-mono text-[11px] text-gray-700">
            <div className="flex justify-between gap-2">
              <dt className="text-gray-400">session</dt>
              <dd
                className={cn(
                  "font-semibold",
                  sdkSession === "present"
                    ? "text-emerald-700"
                    : sdkSession === "cleared"
                      ? "text-red-700"
                      : "text-gray-500",
                )}
              >
                {sdkSession}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <button
        onClick={handleSimulate}
        className={cn(
          "mt-4 w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer",
          "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
          "flex items-center justify-center gap-2",
        )}
      >
        <AlertTriangle className="h-4 w-4" />
        Clear session (simulate expiry)
      </button>

      {cleared && (
        <p className="mt-3 border-t border-gray-200 pt-2 text-xs text-gray-600">
          SDK session <span className="font-semibold text-red-700">cleared</span>
          , but wagmi still reports{" "}
          <span className="font-semibold text-emerald-700">{status}</span> — the
          app has no signal to react to. Trigger a sign/read to see it break.
        </p>
      )}
      {error && (
        <p className="mt-3 border-t border-gray-200 pt-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
