"use client";

import { ArrowUpDown, ChevronRight, ExternalLink } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { inputClass } from "./ui";
import type { EarnState } from "./useEarnState";
import { CHAIN_NAME, chainName, explorerAddress } from "./utils/chains";
import { fmtApy, fmtTvl } from "./utils/format";

const ALL = "__all__";
type SortKey = "apy" | "tvl";

function SortHeader({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
}) {
  const active = sortKey === col;
  return (
    <th className="px-3 py-2.5 font-medium">
      <button
        type="button"
        onClick={() => onSort(col)}
        className={cn("flex items-center gap-1 uppercase tracking-wide hover:text-gray-900 cursor-pointer", active && "text-gray-900")}
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
        {active && <span className="text-[9px]">{sortDir === "desc" ? "▼" : "▲"}</span>}
      </button>
    </th>
  );
}

/** Step 1: pick a vault. Picking one advances to the quote step. */
export function DiscoverPanel({ d }: { d: EarnState }) {
  const [protocolFilter, setProtocolFilter] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("apy");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function onSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((dir) => (dir === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  const q = search.trim().toLowerCase();
  // The chain select is not a filter: it picks what gets fetched.
  const filtersActive = protocolFilter !== ALL || q !== "";
  function clearFilters() {
    setProtocolFilter(ALL);
    setSearch("");
  }
  const filtered = d.vaults
    .filter((v) => {
      // The fetch is already scoped to `listChainId`; this hides the previous
      // network's rows while the swap is in flight.
      if (v.chainId !== d.listChainId) return false;
      if (protocolFilter !== ALL && v.protocol !== protocolFilter) return false;
      if (q === "") return true;
      return [v.name ?? "", v.asset.symbol, v.protocol, CHAIN_NAME[v.chainId] ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    })
    .sort((a, b) => {
      const av = (sortKey === "apy" ? a.apy : a.tvlUsd) ?? -1;
      const bv = (sortKey === "apy" ? b.apy : b.tvlUsd) ?? -1;
      return sortDir === "desc" ? bv - av : av - bv;
    });

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search asset or protocol..."
          className={inputClass}
        />
        <select
          value={protocolFilter}
          onChange={(e) => setProtocolFilter(e.target.value)}
          className={inputClass}
        >
          <option value={ALL}>All protocols</option>
          {d.protocols.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {filtered.length} vaults on {chainName(d.listChainId ?? 0)}
        </span>
        {filtersActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-blue-500 hover:text-blue-700 font-medium cursor-pointer"
          >
            Clear filters
          </button>
        )}
      </div>

      {d.loadError && (
        <pre className="overflow-auto rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">
          {d.loadError}
        </pre>
      )}

      <div className="max-h-[420px] overflow-auto rounded-lg border border-gray-200">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2.5 font-medium">Vault</th>
              <th className="px-3 py-2.5 font-medium">Protocol</th>
              <SortHeader label="APY" col="apy" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="TVL" col="tvl" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <th className="w-8 px-3 py-2.5" aria-label="Explorer link" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => {
              const isSel = d.selected?.id === v.id;
              return (
                <tr
                  key={v.id}
                  onClick={() => d.select(v)}
                  aria-selected={isSel}
                  className={cn(
                    "cursor-pointer transition-colors [&>td]:border-t [&>td]:border-gray-200",
                    isSel ? "bg-blue-50" : "hover:bg-gray-50",
                  )}
                >
                  <td className="px-3 py-2.5 font-medium text-gray-900">
                    <span className="flex items-center gap-1.5">
                      <ChevronRight
                        className={cn("h-3.5 w-3.5 shrink-0 text-blue-600", isSel ? "opacity-100" : "opacity-0")}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{v.name ?? v.asset.symbol}</span>
                        {v.name && <span className="text-[11px] font-normal text-gray-500">{v.asset.symbol}</span>}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">{v.protocol}</td>
                  <td className="px-3 py-2.5 font-medium tabular-nums text-gray-900">{fmtApy(v.apy)}</td>
                  <td className="px-3 py-2.5 tabular-nums text-gray-500">{fmtTvl(v.tvlUsd)}</td>
                  <td className="px-3 py-2.5">
                    <a
                      href={explorerAddress(v.chainId, v.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View vault on explorer"
                      aria-label="View vault on explorer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-gray-400 transition-colors hover:text-gray-900"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </td>
                </tr>
              );
            })}
            {d.loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                  Loading vaults...
                </td>
              </tr>
            )}
            {!d.loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                  No vaults match the filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
