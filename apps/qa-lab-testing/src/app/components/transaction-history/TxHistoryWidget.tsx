"use client";

import { useState } from "react";
import type { DataApiEnvironment } from "@zerodev/wallet-data";
import { TxHistory } from "@zerodev/wallet-react-ui";
import { useResolvedConfig } from "../../lib/use-wallet-config";
import { cn } from "../../lib/utils";

const ENVIRONMENTS: readonly DataApiEnvironment[] = ["mainnet", "testnet"];

/**
 * Renders the shipped `TxHistory` component from `@zerodev/wallet-react-ui`
 * against the same Data API the diagnostic panel above it uses, so the
 * presentation layer can be tested on a real wallet.
 */
export function TxHistoryWidget() {
  const { dataApiBaseUrl } = useResolvedConfig();
  const [environment, setEnvironment] =
    useState<DataApiEnvironment>("mainnet");
  const [open, setOpen] = useState(false);

  if (!dataApiBaseUrl) return null;

  return (
    <div
      className="rounded-lg border border-[var(--border-warm)] bg-white p-4 sm:p-5"
      data-testid="tx-history-widget-surface"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--ink)]">
            TxHistory component
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            The <code>TxHistory</code> widget from{" "}
            <code>@zerodev/wallet-react-ui</code>, fed by the same Data API.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[var(--border-warm)] bg-[var(--surface-warm)] p-1">
            {ENVIRONMENTS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setEnvironment(value)}
                data-testid={`tx-history-widget-environment-${value}`}
                data-active={String(environment === value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                  environment === value
                    ? "bg-[var(--ink)] text-white"
                    : "text-[var(--muted)] hover:text-[var(--ink)]",
                )}
              >
                {value}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            data-testid="tx-history-widget-toggle"
            className="rounded-lg border border-[var(--border-warm)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-warm)]"
          >
            {open ? "Close" : "Open"}
          </button>
        </div>
      </div>

      {open && (
        <div
          className="mt-4 flex justify-center rounded-lg bg-[var(--surface-warm)] p-4"
          data-testid="tx-history-widget"
        >
          <TxHistory
            key={environment}
            dataApi={{ baseUrl: dataApiBaseUrl, environment }}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
