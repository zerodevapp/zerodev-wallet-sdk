"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { useAccount, useSendTransaction } from "wagmi";
import type { DataApiEnvironment } from "@zerodev/wallet-data";
import { TxHistory, TxHistoryView } from "@zerodev/wallet-react-ui";
import { useResolvedConfig } from "../../lib/use-wallet-config";
import { cn } from "../../lib/utils";
import { useFixtureFeed } from "./fixtureFeed";

const ENVIRONMENTS: readonly DataApiEnvironment[] = ["mainnet", "testnet"];
const SELF_SEND_ETH = "0.00001";

/**
 * Renders the shipped `TxHistory` component from `@zerodev/wallet-react-ui`
 * against the same Data API the diagnostic panel above it uses, so the
 * presentation layer can be tested on a real wallet. "Show fixtures" swaps it
 * for the same screen over every contract fixture, paged like the real feed,
 * so every shape can be checked without a wallet that performed them.
 *
 * Pending transaction (proof of concept): "Send … and watch" sends a tiny
 * self-transfer and passes its hash as `pendingTxHash`; a pasted hash works
 * too. With fixtures on, the fixture feed finds the hash after a few seconds,
 * or gives up when "Never find it" is set.
 */
export function TxHistoryWidget() {
  const { dataApiBaseUrl } = useResolvedConfig();
  const [environment, setEnvironment] =
    useState<DataApiEnvironment>("mainnet");
  const [open, setOpen] = useState(false);
  const [fixturesOn, setFixturesOn] = useState(false);
  const [failNextPage, setFailNextPage] = useState(false);
  const [pendingTxHash, setPendingTxHash] = useState("");
  const [neverFind, setNeverFind] = useState(false);
  const pending = pendingTxHash.trim() || undefined;
  const fixtures = useFixtureFeed({
    failNextPage,
    pendingTxHash: pending,
    findPending: !neverFind,
  });
  const { address } = useAccount();
  const send = useSendTransaction();

  const sendAndWatch = async () => {
    if (!address) return;
    const hash = await send.sendTransactionAsync({
      to: address,
      value: parseEther(SELF_SEND_ETH),
    });
    setPendingTxHash(hash);
    setOpen(true);
  };

  if (!dataApiBaseUrl) return null;

  return (
    <div
      className="rounded-lg border border-[var(--border-warm)] bg-white p-4 sm:p-5"
      data-testid="tx-history-widget-surface"
      data-fixtures={fixturesOn ? "on" : "off"}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--ink)]">
            TxHistory component
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            The <code>TxHistory</code> widget from{" "}
            <code>@zerodev/wallet-react-ui</code>, fed by the same Data API.
            Switch on fixtures to render every recorded shape instead of the
            connected wallet&apos;s history, paged by Load more; the panel
            above keeps showing the real request.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex shrink-0 cursor-pointer items-center gap-2.5">
            <span className="text-xs font-semibold text-[var(--ink)]">
              Show fixtures
            </span>
            <span className="relative inline-flex h-6 w-11 shrink-0">
              <input
                type="checkbox"
                checked={fixturesOn}
                onChange={(event) => setFixturesOn(event.target.checked)}
                data-testid="tx-history-widget-fixtures-toggle"
                className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0"
              />
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none h-6 w-11 rounded-full transition-colors",
                  "after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5",
                  "after:rounded-full after:bg-white after:shadow after:transition-transform",
                  "bg-gray-300 peer-checked:bg-emerald-500 peer-checked:after:translate-x-5",
                  "peer-focus-visible:ring-2 peer-focus-visible:ring-gray-950 peer-focus-visible:ring-offset-2",
                )}
              />
            </span>
          </label>

          {fixturesOn && (
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--ink)]">
              <input
                type="checkbox"
                checked={failNextPage}
                onChange={(event) => setFailNextPage(event.target.checked)}
                data-testid="tx-history-widget-fail-next-page"
                className="h-3.5 w-3.5 accent-[var(--ink)]"
              />
              Fail next page
            </label>
          )}

          <div className="inline-flex rounded-lg border border-[var(--border-warm)] bg-[var(--surface-warm)] p-1">
            {ENVIRONMENTS.map((value) => (
              <button
                key={value}
                type="button"
                disabled={fixturesOn}
                onClick={() => setEnvironment(value)}
                data-testid={`tx-history-widget-environment-${value}`}
                data-active={String(environment === value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-40",
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

      <div
        className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-[var(--border-warm)] p-3"
        data-testid="tx-history-widget-pending"
      >
        <span className="text-xs font-semibold text-[var(--ink)]">
          Pending tx (PoC)
        </span>
        <button
          type="button"
          onClick={sendAndWatch}
          disabled={!address || send.isPending || fixturesOn}
          data-testid="tx-history-widget-send-and-watch"
          className="rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {send.isPending ? "Sending…" : `Send ${SELF_SEND_ETH} ETH to self and watch`}
        </button>
        <input
          type="text"
          value={pendingTxHash}
          onChange={(event) => setPendingTxHash(event.target.value)}
          placeholder="…or paste a tx hash"
          spellCheck={false}
          data-testid="tx-history-widget-pending-hash"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border-warm)] px-2 py-1.5 font-mono text-xs"
        />
        {fixturesOn && (
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--ink)]">
            <input
              type="checkbox"
              checked={neverFind}
              onChange={(event) => setNeverFind(event.target.checked)}
              data-testid="tx-history-widget-never-find"
              className="h-3.5 w-3.5 accent-[var(--ink)]"
            />
            Never find it
          </label>
        )}
        {pendingTxHash && (
          <button
            type="button"
            onClick={() => setPendingTxHash("")}
            data-testid="tx-history-widget-pending-clear"
            className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Clear
          </button>
        )}
        {send.error && (
          <p className="w-full text-xs text-red-700" role="alert">
            {send.error.message.split("\n")[0]}
          </p>
        )}
      </div>

      {open && (
        <div
          className="mt-4 flex justify-center rounded-lg bg-[var(--surface-warm)] p-4"
          data-testid="tx-history-widget"
        >
          {fixturesOn ? (
            <TxHistoryView
              key="fixtures"
              feed={fixtures}
              onClose={() => setOpen(false)}
            />
          ) : (
            <TxHistory
              key={environment}
              dataApi={{ baseUrl: dataApiBaseUrl, environment }}
              onClose={() => setOpen(false)}
              {...(pending && { pendingTxHash: pending })}
            />
          )}
        </div>
      )}
    </div>
  );
}
