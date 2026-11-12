"use client";

import { Loader2 } from "lucide-react";

export type DisconnectChoice = "all" | "eip155" | "solana";

type DisconnectDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onChoose: (choice: DisconnectChoice) => void;
  evmConnected: boolean;
  solanaConnected: boolean;
  /** A disconnect is running; the dialog stays open so the choice is visible. */
  busy: DisconnectChoice | null;
};

/**
 * Asks which side to disconnect when more than one wallet can be connected.
 */
export function DisconnectDialog({
  isOpen,
  onClose,
  onChoose,
  evmConnected,
  solanaConnected,
  busy,
}: DisconnectDialogProps) {
  if (!isOpen) return null;

  const options: {
    choice: DisconnectChoice;
    label: string;
    hint: string;
    enabled: boolean;
  }[] = [
    {
      choice: "all",
      label: "Disconnect all",
      hint: "Ends every connection and returns to sign-in",
      enabled: true,
    },
    {
      choice: "eip155",
      label: "Disconnect EVM only",
      hint: evmConnected
        ? "Keeps the Solana connection"
        : "No EVM connection to end",
      enabled: evmConnected,
    },
    {
      choice: "solana",
      label: "Disconnect Solana only",
      hint: solanaConnected
        ? "Keeps the EVM connection"
        : "No Solana connection to end",
      enabled: solanaConnected,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 font-[var(--font-dm-sans)]"
        role="dialog"
        aria-modal="true"
        aria-label="Disconnect"
        data-testid="disconnect-dialog"
        data-evm-connected={String(evmConnected)}
        data-solana-connected={String(solanaConnected)}
        data-busy={busy ?? ""}
      >
        <h2 className="text-lg font-semibold text-[var(--ink)]">
          What should be disconnected?
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          More than one wallet is connected. Pick which side to end.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {options.map(({ choice, label, hint, enabled }) => (
            <button
              key={choice}
              type="button"
              disabled={!enabled || busy !== null}
              onClick={() => onChoose(choice)}
              data-testid={`disconnect-${choice}`}
              data-enabled={String(enabled)}
              className={
                enabled
                  ? "flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[var(--border-warm)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface-warm)] disabled:cursor-wait"
                  : "flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-warm)] px-4 py-3 text-left opacity-40"
              }
            >
              <span>
                <span className="block text-sm font-semibold text-[var(--ink)]">
                  {label}
                </span>
                <span className="block text-[11px] text-[var(--muted)]">
                  {hint}
                </span>
              </span>
              {busy === choice && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--muted)]" />
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={busy !== null}
          data-testid="disconnect-cancel"
          className="mt-4 w-full cursor-pointer rounded-2xl px-4 py-2 text-sm font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--surface-warm)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
