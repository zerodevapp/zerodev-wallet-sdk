import type {
  TransactionHistoryItem,
  TransactionHistoryOperation,
} from "@zerodev/wallet-data";
import {
  TRANSACTION_HISTORY_FIXTURES,
  type TransactionHistoryFixtureId,
} from "@zerodev/wallet-data/fixtures";
import { type HistoryFeed, toTxHistoryEntry } from "@zerodev/wallet-react-ui";

interface FixtureSpec {
  id: TransactionHistoryFixtureId;
  /** Zerion has never labelled this operation on a recorded item, so the
   * asset-less execute golden stands in with the operation swapped. */
  operation?: TransactionHistoryOperation;
}

/** One row per operation, a one-sided swap, and the inert unparsed row. */
const FIXTURE_SPECS: readonly FixtureSpec[] = [
  { id: "approveFungible" },
  { id: "executeNoAsset", operation: "bid" },
  { id: "burn" },
  { id: "receiveClaim" },
  { id: "executeNoAsset", operation: "delegate" },
  { id: "deploy" },
  { id: "deposit" },
  { id: "execute" },
  { id: "mint" },
  { id: "receive" },
  { id: "revoke" },
  { id: "executeNoAsset", operation: "revoke_delegation" },
  { id: "send" },
  { id: "swapTwoSided" },
  { id: "swapOutOnly" },
  { id: "withdraw" },
  { id: "operationOther" },
  { id: "unparsedWithChain" },
];

const HOURS_7 = 7 * 60 * 60;

/**
 * Goldens share Zerion ids across shapes, so each row is re-keyed by its
 * fixture id and position. Timestamps step back seven hours per row from
 * `nowSeconds` so the list shows "Today", "Yesterday" and a dated header.
 */
export function buildFixtureFeed(nowSeconds: number): HistoryFeed {
  const entries = FIXTURE_SPECS.flatMap((spec, i) => {
    const item: TransactionHistoryItem = TRANSACTION_HISTORY_FIXTURES[spec.id];
    const timestamp = nowSeconds - i * HOURS_7;
    const row: TransactionHistoryItem =
      "kind" in item
        ? { ...item, timestamp }
        : {
            ...item,
            id: `${spec.id}-${i}`,
            timestamp,
            ...(spec.operation && { operation: spec.operation }),
          };
    return toTxHistoryEntry(row) ?? [];
  });
  return {
    status: "ready",
    entries,
    hasMore: false,
    loadingMore: false,
    loadMore: () => {},
  };
}
