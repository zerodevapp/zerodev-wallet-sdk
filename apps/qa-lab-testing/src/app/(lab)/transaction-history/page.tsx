import { FeatureHeader } from "../../components/lab/FeatureHeader";
import { TransactionHistoryPanel } from "../../components/transaction-history/TransactionHistoryPanel";

export const dynamic = "force-dynamic";

export default function TransactionHistoryPage() {
  return (
    <>
      <FeatureHeader featureId="transaction-history">
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          This is a diagnostic surface, not the final history UI. It renders the
          API response directly so request authentication and pagination can be
          tested independently from presentation mapping.
        </p>
      </FeatureHeader>

      <div className="mt-4">
        <TransactionHistoryPanel />
      </div>
    </>
  );
}
