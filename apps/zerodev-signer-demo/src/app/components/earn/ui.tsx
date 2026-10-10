"use client";

import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export const inputClass = cn(
  "w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm bg-white",
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
  "text-gray-900 placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-400",
);

export const primaryButtonClass = cn(
  "w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer",
  "border border-gray-950 bg-gray-950 text-white hover:bg-black hover:shadow-sm",
  "disabled:opacity-50 disabled:cursor-not-allowed",
  "flex items-center justify-center gap-2",
);

export const smallButtonClass = cn(
  "inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700",
  "transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
);

export const chipClass =
  "inline-flex w-fit items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-800";

export const linkChipClass =
  "inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50";

export function ErrorBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-lg overflow-hidden">
      <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-red-900">{title}</p>
        <div className="text-sm text-red-700 mt-0.5 break-words">{children}</div>
      </div>
    </div>
  );
}

/**
 * Two-style segmented control. `tabs` is the Batch tab's ETH/USDC box;
 * `pill` is the wallet card's rounded toggle.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  variant = "tabs",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; disabled?: boolean; title?: string }[];
  variant?: "tabs" | "pill";
}) {
  // Literal class names so Tailwind picks them up.
  const cols = options.length === 2 ? "grid-cols-2" : "grid-cols-3";
  if (variant === "pill") {
    return (
      <div className={cn("grid gap-1 rounded-full border border-gray-200 bg-gray-100 p-1", cols)}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            disabled={o.disabled}
            title={o.title}
            className={cn(
              "h-7 rounded-full px-3 text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
              value === o.value ? "bg-white text-gray-950 shadow-sm" : "text-gray-500 hover:text-gray-900",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className={cn("grid gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1", cols)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          disabled={o.disabled}
          title={o.title}
          className={cn(
            "flex h-10 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-semibold transition-all cursor-pointer sm:px-4 sm:text-sm",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
            value === o.value
              ? "border-gray-200 bg-white text-gray-950 shadow-sm"
              : "border-transparent text-gray-500 hover:bg-white hover:text-gray-800",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
