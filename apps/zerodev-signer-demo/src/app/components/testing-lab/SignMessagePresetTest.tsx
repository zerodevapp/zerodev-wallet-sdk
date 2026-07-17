"use client";

import {
  AlertCircle,
  Check,
  FileSignature,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { hashMessage } from "viem";
import { useAccount, usePublicClient, useSignMessage } from "wagmi";
import { cn } from "../../lib/utils";

type VerifyStatus = "verifying" | "valid" | "invalid";
type RunStatus = "pending" | "success" | "error";

interface TestRun {
  id: number;
  preset: string;
  message: string;
  /** EIP-191 hash of the exact message sent — a deterministic fingerprint. */
  expectedHash: string;
  status: RunStatus;
  signature?: string;
  error?: string;
  verify?: VerifyStatus;
}

interface Preset {
  key: string;
  label: string;
  /** Whether the message embeds the run counter (distinct on every fire). */
  dynamic?: boolean;
  build: (n: number) => string;
}

const PRESETS: Preset[] = [
  {
    key: "counter",
    label: "Counter (auto-increment)",
    dynamic: true,
    build: (n) => `Stress test message #${n}`,
  },
  { key: "empty", label: "Empty string", build: () => "" },
  { key: "whitespace", label: "Whitespace only", build: () => "   \t  \n " },
  { key: "long-1k", label: "Long text (~1 KB)", build: () => "A".repeat(1_024) },
  {
    key: "long-100k",
    label: "Very long (~100 KB)",
    build: () => "A".repeat(100_000),
  },
  {
    key: "emoji",
    label: "Emoji / ZWJ / multibyte",
    build: () => "👨‍👩‍👧‍👦🔥🚀 café résumé 日本語",
  },
  {
    key: "rtl",
    label: "RTL / bidi override",
    build: () => "user‮nigol‬ admin مرحبا שלום",
  },
  {
    key: "zero-width",
    label: "Zero-width / invisible chars",
    build: () => "in​visi​ble﻿text",
  },
  { key: "homoglyph", label: "Homoglyph (Cyrillic)", build: () => "аррӏе.com" },
  {
    key: "control",
    label: "Control chars (newlines/tabs)",
    build: () => "line1\nline2\ttabbed\r\nend",
  },
  {
    key: "hex",
    label: "0x-prefixed (signed as text)",
    build: () => "0xdeadbeefcafebabe",
  },
  {
    key: "json",
    label: "JSON-looking string",
    build: () =>
      '{"type":"transfer","to":"0x000000000000000000000000000000000000dEaD","amount":"1000"}',
  },
  {
    key: "address-amount",
    label: "Address / amount text",
    build: () =>
      "Send 1000 ETH to 0x000000000000000000000000000000000000dEaD now",
  },
  {
    key: "html",
    label: "HTML / script injection",
    build: () => '<img src=x onerror=alert(1)></img><script>alert(1)</script>',
  },
  {
    key: "markdown",
    label: "Markdown / template",
    build: () => "**bold** `code` ${7*7} {{7*7}} [x](javascript:alert(1))",
  },
];

const shortHex = (hex: string) => `${hex.slice(0, 10)}…${hex.slice(-6)}`;

const previewMessage = (message: string) => {
  if (message.trim() === "") return "(empty / whitespace)";
  const collapsed = message.replace(/\s+/g, " ").trim();
  return collapsed.length > 64 ? `${collapsed.slice(0, 64)}…` : collapsed;
};

/**
 * Test Case #2 — signs preset "edge case" messages chosen from a dropdown.
 * The textarea shows the exact message that will be sent (editable). The
 * button is never gated on a pending state, so requests stack into the Tx
 * review queue.
 *
 * Each fire records the EIP-191 hash of the exact message sent, then verifies
 * the returned signature against this account (handles EOA / ERC-1271 /
 * ERC-6492) FOR THAT message. This proves the mapping is correct: if you
 * reject request #5 and accept #6, #6's row shows #6's expected hash and a
 * "valid" badge only if the returned signature really is for #6's message.
 */
export function SignMessagePresetTest() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { signMessageAsync } = useSignMessage();

  const [presetKey, setPresetKey] = useState<string>(PRESETS[0].key);
  const [text, setText] = useState<string>(() => PRESETS[0].build(1));
  const [counter, setCounter] = useState(0);
  const [runs, setRuns] = useState<TestRun[]>([]);

  const activePreset =
    PRESETS.find((p) => p.key === presetKey) ?? PRESETS[0];

  const updateRun = (id: number, patch: Partial<TestRun>) =>
    setRuns((prev) =>
      prev.map((run) => (run.id === id ? { ...run, ...patch } : run)),
    );

  const handlePresetChange = (key: string) => {
    const preset = PRESETS.find((p) => p.key === key) ?? PRESETS[0];
    setPresetKey(key);
    setText(preset.build(counter + 1));
  };

  const handleSign = () => {
    const id = counter + 1;
    setCounter(id);
    const message = text;
    const expectedHash = hashMessage(message);
    setRuns((prev) => [
      { id, preset: presetKey, message, expectedHash, status: "pending" },
      ...prev,
    ]);

    // Auto-advance the textarea for dynamic presets, unless the user edited it.
    if (activePreset.dynamic && text === activePreset.build(id)) {
      setText(activePreset.build(id + 1));
    }

    signMessageAsync({ message })
      .then(async (signature) => {
        updateRun(id, { status: "success", signature, verify: "verifying" });
        if (!publicClient || !address) {
          updateRun(id, { verify: undefined });
          return;
        }
        try {
          const valid = await publicClient.verifyMessage({
            address,
            message,
            signature,
          });
          updateRun(id, { verify: valid ? "valid" : "invalid" });
        } catch {
          updateRun(id, { verify: "invalid" });
        }
      })
      .catch((err) =>
        updateRun(id, {
          status: "error",
          error: err instanceof Error ? err.message : "Signing failed",
        }),
      );
  };

  const isEdited = text !== activePreset.build(counter + 1);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Sign message (edge-case presets)
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Pick a payload type, then fire it (button never disabled) to stack
            the Tx review queue. Each fire records the message&apos;s EIP-191
            hash and verifies the returned signature against this account for
            that exact message.
          </p>
        </div>
        {runs.length > 0 && (
          <button
            onClick={() => setRuns([])}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Preset selector */}
      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Message type
        </label>
        <select
          value={presetKey}
          onChange={(e) => handlePresetChange(e.target.value)}
          className={cn(
            "w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 cursor-pointer",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
          )}
        >
          {PRESETS.map((preset) => (
            <option key={preset.key} value={preset.key}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>

      {/* Message textarea (shows exactly what will be sent) */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Message to sign
          </label>
          {isEdited && (
            <button
              onClick={() => setText(activePreset.build(counter + 1))}
              className="flex items-center gap-1 text-sm font-medium text-blue-500 hover:text-blue-700 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Reset to preset
            </button>
          )}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          spellCheck={false}
          placeholder="Message to sign..."
          className={cn(
            "w-full rounded-lg border border-gray-200 px-4 py-3 font-mono text-sm",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            "text-gray-900 placeholder:text-gray-400",
          )}
        />
        <p className="mt-1 text-xs text-gray-400">
          {text.length.toLocaleString()} chars
          {activePreset.dynamic && " · auto-increments each fire"}
        </p>
      </div>

      <button
        onClick={handleSign}
        className={cn(
          "mt-4 w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer",
          "border border-gray-950 bg-gray-950 text-white hover:bg-black hover:shadow-sm",
          "flex items-center justify-center gap-2",
        )}
      >
        <FileSignature className="h-4 w-4" />
        Sign message #{counter + 1}
      </button>

      {runs.length > 0 && (
        <ul className="mt-4 space-y-2">
          {runs.map((run) => (
            <li
              key={run.id}
              className="space-y-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <div className="flex items-center gap-2.5">
                <span className="shrink-0">
                  {run.status === "pending" && (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  )}
                  {run.status === "success" && (
                    <Check className="h-4 w-4 text-emerald-600" />
                  )}
                  {run.status === "error" && (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                </span>
                <span className="shrink-0 text-sm font-medium text-gray-900">
                  #{run.id}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-gray-500">
                  {run.status === "error"
                    ? run.error
                    : previewMessage(run.message)}
                </span>
                {run.verify === "valid" && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <ShieldCheck className="h-3 w-3" />
                    valid
                  </span>
                )}
                {run.verify === "invalid" && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                    <ShieldAlert className="h-3 w-3" />
                    invalid
                  </span>
                )}
                {run.verify === "verifying" && (
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                    verifying…
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 pl-[26px] font-mono text-[11px] text-gray-400">
                <span title={run.expectedHash}>
                  hash {shortHex(run.expectedHash)}
                </span>
                {run.signature && (
                  <span title={run.signature}>
                    sig {shortHex(run.signature)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
