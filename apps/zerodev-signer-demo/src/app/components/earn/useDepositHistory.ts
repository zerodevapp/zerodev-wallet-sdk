"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Address } from "viem";
import {
  type DepositRecord,
  getServerSnapshot,
  getSnapshot,
  removeDeposit,
  subscribe,
} from "./utils/historyStore";

/** Persisted deposits for one owner, newest first. Updates on in-tab and cross-tab writes. */
export function useDepositHistory(owner: Address | undefined): {
  records: DepositRecord[];
  remove: (quoteId: string) => void;
} {
  const all = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const records = useMemo(() => {
    if (!owner) return [];
    const lower = owner.toLowerCase();
    return all.filter((r) => r.owner.toLowerCase() === lower);
  }, [all, owner]);
  return { records, remove: removeDeposit };
}
