"use client";

import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import {
  DataApiError,
  type DataApiEnvironment,
  useTransactionHistory,
} from "@zerodev/wallet-data";
import { useAccount } from "wagmi";
import { useResolvedConfig } from "../../lib/use-wallet-config";
import { cn } from "../../lib/utils";

const ENVIRONMENTS: readonly DataApiEnvironment[] = ["mainnet", "testnet"];

function ErrorDetails({ error }: { error: Error }) {
  const requestError = error instanceof DataApiError ? error : undefined;

  return (
    <div
      className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
      data-testid="transaction-history-error"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Request failed</p>
          <p className="mt-1 break-words text-xs leading-5">{error.message}</p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-2 font-mono text-[11px] sm:grid-cols-3">
        <div>
          <dt className="text-red-500">name</dt>
          <dd className="break-all">{error.name}</dd>
        </div>
        <div>
          <dt className="text-red-500">status</dt>
          <dd>{requestError?.status ?? "no response"}</dd>
        </div>
        <div>
          <dt className="text-red-500">retryAfterMs</dt>
          <dd>{requestError?.retryAfterMs ?? "—"}</dd>
        </div>
      </dl>

      {requestError?.body !== undefined && (
        <pre className="mt-3 max-h-40 overflow-auto rounded bg-red-100 p-3 text-[11px] leading-5">
          {JSON.stringify(requestError.body, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ConfiguredTransactionHistoryPanel({ baseUrl }: { baseUrl: string }) {
  const [environment, setEnvironment] =
    useState<DataApiEnvironment>("mainnet");
  const { address } = useAccount();
  const history = useTransactionHistory({ baseUrl, environment });
  const pages = history.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const error = history.error;

  return (
    <div className="space-y-4" data-testid="transaction-history-surface">
      <div className="rounded-lg border border-[var(--border-warm)] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--ink)]">
              Stamped request
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Calls the real Data API through <code>useTransactionHistory</code>.
              Inspect the browser Network panel to see the wallet address,
              timestamp, environment, and P-256 stamp headers.
            </p>
          </div>

          <div className="inline-flex rounded-lg border border-[var(--border-warm)] bg-[var(--surface-warm)] p-1">
            {ENVIRONMENTS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setEnvironment(value)}
                data-testid={`transaction-history-environment-${value}`}
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
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
            <dt className="text-xs font-semibold text-gray-500">Data API</dt>
            <dd
              className={cn(
                "mt-1 text-sm font-semibold",
                "text-emerald-700",
              )}
              data-testid="transaction-history-api-configured"
            >
              configured
            </dd>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
            <dt className="text-xs font-semibold text-gray-500">Dapp account</dt>
            <dd
              className="mt-1 break-all font-mono text-xs text-gray-800"
              data-testid="transaction-history-address"
            >
              {address ?? "—"}
            </dd>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
            <dt className="text-xs font-semibold text-gray-500">Query</dt>
            <dd className="mt-1 font-mono text-xs text-gray-800">
              {history.fetchStatus} · failures {history.failureCount}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void history.refetch()}
            disabled={history.isFetching}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--ink)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#2a1c13] disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="transaction-history-refetch"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", history.isFetching && "animate-spin")}
            />
            Refetch
          </button>
          <button
            type="button"
            onClick={() => void history.fetchNextPage()}
            disabled={!history.hasNextPage || history.isFetchingNextPage}
            className="inline-flex h-9 items-center rounded-lg border border-[var(--border-warm)] bg-white px-3 text-xs font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-warm)] disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="transaction-history-next-page"
          >
            {history.isFetchingNextPage ? "Loading next page…" : "Load next page"}
          </button>
        </div>
      </div>

      {history.isPending && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border-warm)] bg-white p-4 text-sm text-[var(--muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Signing and fetching transaction history…
        </div>
      )}

      {error && <ErrorDetails error={error} />}

      {history.isSuccess && (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"
          data-testid="transaction-history-success"
        >
          <div className="flex items-start gap-2 text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="text-sm font-semibold">
                Authenticated request succeeded
              </p>
              <p className="mt-1 text-xs leading-5">
                Received {items.length} item{items.length === 1 ? "" : "s"} across{" "}
                {pages.length} page{pages.length === 1 ? "" : "s"}.
                {items.length === 0 && " A zero-item response still confirms the stamp was accepted."}
              </p>
            </div>
          </div>
        </div>
      )}

      {pages.map((page, index) => (
        <section
          key={index}
          className="overflow-hidden rounded-lg border border-[var(--border-warm)] bg-white"
          data-testid={`transaction-history-page-${index}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-warm)] bg-[var(--surface-warm)] px-4 py-3">
            <h3 className="text-sm font-semibold text-[var(--ink)]">
              Page {index + 1} · {page.items.length} items
            </h3>
            <span className="font-mono text-[10px] text-[var(--muted)]">
              next: {page.next ? "present" : "none"}
            </span>
          </div>
          <pre className="max-h-[32rem] overflow-auto p-4 text-[11px] leading-5 text-gray-700">
            {JSON.stringify(page, null, 2)}
          </pre>
        </section>
      ))}
    </div>
  );
}

export function TransactionHistoryPanel() {
  const { dataApiBaseUrl } = useResolvedConfig();

  if (!dataApiBaseUrl) {
    return (
      <div
        className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        data-testid="transaction-history-api-configured"
      >
        Set <code>NEXT_PUBLIC_DATA_API_BASE_URL</code> and restart the QA Lab to
        enable the optional wallet-data package.
      </div>
    );
  }

  return <ConfiguredTransactionHistoryPanel baseUrl={dataApiBaseUrl} />;
}
