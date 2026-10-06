"use client";

import { RefreshCw, Wallet } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Small pill for the wallet card's "add the other namespace" rows: an
 * installed wallet (icon + name) that connects on click, or a dashed
 * fallback that opens a fuller flow. One component for both chains so the
 * two rows cannot drift apart.
 */
export function WalletPill({
  label,
  icon,
  pending = false,
  disabled = false,
  dashed = false,
  title,
  testId,
  onClick,
}: {
  label: ReactNode;
  /** Wallet icon URL (a data: URI from the wallet itself); omitted → generic. */
  icon?: string;
  pending?: boolean;
  disabled?: boolean;
  dashed?: boolean;
  title?: string;
  testId?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      data-testid={testId}
      title={title}
      className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border bg-white px-3 text-xs font-semibold text-[#423a32] transition-colors hover:bg-[var(--surface-warm)] disabled:cursor-default disabled:opacity-60 ${
        dashed ? "border-dashed border-[var(--border-warm)]" : "border-[var(--border-warm)]"
      }`}
    >
      {pending ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      ) : icon ? (
        // eslint-disable-next-line @next/next/no-img-element -- wallet icons are data: URIs from the wallet itself
        <img src={icon} alt="" className="h-4 w-4 rounded" />
      ) : dashed ? null : (
        <Wallet className="h-3.5 w-3.5" />
      )}
      {label}
    </button>
  );
}
