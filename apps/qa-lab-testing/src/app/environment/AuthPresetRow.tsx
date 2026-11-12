"use client";

import {
  type AuthPresetSource,
  useAuthPreset,
} from "../lib/use-auth-preset";
import { AUTH_PRESETS, type AuthPresetId } from "../lib/wallet-config";

const SOURCE_LABEL = {
  url: "from URL",
  stored: "stored",
  default: "default",
} as const;

/**
 * The active sign-in preset. A client island because the preset can come from
 * localStorage, which the server cannot read.
 *
 * The source is part of the answer: "stored" and "default" are indistinguishable
 * from the preset id alone, and it's the first thing you want when the preset
 * isn't what you expected.
 */
export function AuthPresetRow({
  urlPreset,
}: {
  /**
   * What `?preset=` resolved to on the server. The URL outranks storage, so
   * when it names a preset the answer is definitive and needs no hydration.
   */
  urlPreset?: AuthPresetId | undefined;
}) {
  const { preset, source, ready } = useAuthPreset();

  // Pre-hydration. With no param, storage is the only answer and only the
  // client can read it.
  if (!ready) {
    if (!urlPreset) {
      return (
        <Chip testId="env-auth-preset-pending" tone="neutral">
          reading…
        </Chip>
      );
    }
    return <PresetChips preset={urlPreset} source="url" />;
  }

  return <PresetChips preset={preset} source={source} />;
}

function PresetChips({
  preset,
  source,
}: {
  preset: AuthPresetId;
  source: AuthPresetSource;
}) {
  return (
    <>
      <Chip testId={`env-auth-preset-${preset}`}>{preset}</Chip>
      <Chip testId="env-auth-preset-label">{AUTH_PRESETS[preset].label}</Chip>
      <Chip
        testId="env-auth-preset-source"
        tone={source === "default" ? "neutral" : "pass"}
        data-source={source}
      >
        {SOURCE_LABEL[source]}
      </Chip>
    </>
  );
}

function Chip({
  testId,
  tone = "neutral",
  children,
  ...rest
}: {
  testId: string;
  tone?: "pass" | "neutral";
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs font-semibold ${
        tone === "pass"
          ? "border-green-100 bg-green-50 text-green-700"
          : "border-[var(--border-warm)] bg-[var(--surface-warm)] text-[var(--ink)]"
      }`}
      {...rest}
    >
      {children}
    </span>
  );
}
