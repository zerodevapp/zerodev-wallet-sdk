import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  TransactionHistoryItem,
  TransactionHistoryOperation,
} from "@zerodev/wallet-data";
import {
  TRANSACTION_HISTORY_FIXTURE_IDS,
  TRANSACTION_HISTORY_FIXTURES,
} from "@zerodev/wallet-data/fixtures";
import {
  type HistoryFeed,
  type TxHistoryEntry,
  toTxHistoryEntry,
} from "@zerodev/wallet-react-ui";

/** Zerion has never labelled these on a recorded item, so the asset-less
 * execute golden stands in with the operation swapped, as the stories do. */
const BORROWED_OPERATIONS: readonly TransactionHistoryOperation[] = [
  "bid",
  "delegate",
  "revoke_delegation",
];

const HOURS_5 = 5 * 60 * 60;
export const FIXTURE_PAGE_SIZE = 12;
const LOAD_DELAY_MS = 800;

/**
 * Every published golden as a row, plus the three borrowed operations.
 * Goldens share Zerion ids and hashes across shapes, so each parsed row is
 * re-keyed by its fixture id and each unparsed row by its position. Timestamps step back five hours per row from `nowSeconds` so
 * the list shows "Today", "Yesterday" and dated headers; the unparsed golden
 * recorded without one gets one too, so it renders as an inert row.
 */
export function buildFixtureRows(nowSeconds: number): TxHistoryEntry[] {
  const goldens: TransactionHistoryItem[] = TRANSACTION_HISTORY_FIXTURE_IDS.map(
    (id) => {
      const item: TransactionHistoryItem = TRANSACTION_HISTORY_FIXTURES[id];
      return "kind" in item ? item : { ...item, id };
    },
  );
  const borrowed: TransactionHistoryItem[] = BORROWED_OPERATIONS.map(
    (operation) => ({
      ...TRANSACTION_HISTORY_FIXTURES.executeNoAsset,
      id: `executeNoAsset-${operation}`,
      operation,
    }),
  );
  return [...goldens, ...borrowed].flatMap((item, i) => {
    const timestamp = nowSeconds - i * HOURS_5;
    const row: TransactionHistoryItem =
      "kind" in item
        ? {
            ...item,
            timestamp,
            txHash: `${item.txHash.slice(0, -2)}${i.toString(16).padStart(2, "0")}`,
          }
        : { ...item, timestamp };
    return toTxHistoryEntry(row) ?? [];
  });
}

/**
 * A ready feed over the fixture rows that pages like the real one: Load more
 * shows its loading state for a moment, then reveals the next page, or the
 * inline error when `failNextPage` is set.
 */
export function useFixtureFeed({
  failNextPage,
}: {
  failNextPage: boolean;
}): HistoryFeed {
  const rows = useMemo(() => buildFixtureRows(Math.floor(Date.now() / 1000)), []);
  const [pages, setPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<Error>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const loadMore = useCallback(() => {
    if (loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(undefined);
    timer.current = setTimeout(() => {
      setLoadingMore(false);
      if (failNextPage) {
        setLoadMoreError(new Error("Fixture page failed on request"));
      } else {
        setPages((current) => current + 1);
      }
    }, LOAD_DELAY_MS);
  }, [failNextPage, loadingMore]);

  const shown = pages * FIXTURE_PAGE_SIZE;
  return {
    status: "ready",
    entries: rows.slice(0, shown),
    hasMore: shown < rows.length,
    loadingMore,
    loadMore,
    ...(loadMoreError && { loadMoreError }),
  };
}
