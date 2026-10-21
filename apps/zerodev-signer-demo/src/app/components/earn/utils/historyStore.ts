import type { EarnState } from "@zerodev/earn";
import type { Address, Hex } from "viem";

export type ExecPhase = "idle" | "signing" | "bridging" | "deposited" | "error";

/** In-app execution phases plus the server's earn states. */
export type HistoryPhase = ExecPhase | EarnState;

/**
 * One persisted deposit attempt. `sra` is the field that matters: a deposit
 * interrupted before the relayer settles leaves funds at that address, and
 * without it the user cannot recover them.
 */
export interface DepositRecord {
  /** Quote id. Re-executing the same quote upserts in place. */
  quoteId: string;
  createdAt: number;
  updatedAt: number;
  owner: Address;
  sra: Address;
  vault: {
    address: Address;
    chainId: number;
    assetSymbol: string;
    protocol: string;
  };
  srcChainId: number;
  srcSymbol: string;
  amount: string;
  txHashes: Hex[];
  phase: HistoryPhase;
}

const KEY = "zd:earn-deposits.v1";
const CAP = 50;
const EMPTY: DepositRecord[] = [];

type Listener = () => void;
const listeners = new Set<Listener>();

/** Stable snapshot so useSyncExternalStore does not loop. */
let cache: DepositRecord[] | null = null;

function read(): DepositRecord[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as DepositRecord[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(records: DepositRecord[]): void {
  cache = records;
  try {
    localStorage.setItem(KEY, JSON.stringify(records));
  } catch {
    // Quota or disabled storage: keep the in-memory cache only.
  }
  for (const l of listeners) l();
}

export function getSnapshot(): DepositRecord[] {
  return read();
}

/** The dashboard is `force-dynamic` but still renders once on the server. */
export function getServerSnapshot(): DepositRecord[] {
  return EMPTY;
}

/** In-tab writes plus the `storage` event from other tabs. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      for (const l of listeners) l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function upsertDeposit(rec: DepositRecord): void {
  const all = read();
  const existing = all.find((r) => r.quoteId === rec.quoteId);
  const merged = existing
    ? { ...existing, ...rec, createdAt: existing.createdAt, updatedAt: rec.updatedAt }
    : rec;
  const next = existing
    ? all.map((r) => (r.quoteId === rec.quoteId ? merged : r))
    : [merged, ...all];
  next.sort((a, b) => b.createdAt - a.createdAt);
  write(next.slice(0, CAP));
}

export function patchPhase(quoteId: string, phase: HistoryPhase, updatedAt: number): void {
  const all = read();
  const idx = all.findIndex((r) => r.quoteId === quoteId);
  if (idx < 0) return;
  write(all.map((r, i) => (i === idx ? { ...r, phase, updatedAt } : r)));
}

export function removeDeposit(quoteId: string): void {
  write(read().filter((r) => r.quoteId !== quoteId));
}
