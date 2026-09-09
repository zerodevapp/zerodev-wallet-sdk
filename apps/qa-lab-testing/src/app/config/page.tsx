"use client";

import { ArrowLeft, Check, Copy, RotateCcw, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { ConfigLink } from "../components/ConfigLink";
import {
  CHAINS,
  PARAM,
  resolveWalletConfig,
  serializeOverrides,
} from "../lib/config-params";
import { clearStoredPreset, useAuthPreset } from "../lib/use-auth-preset";
import {
  AUTH_FLAVOR_IDS,
  AUTH_PRESET_IDS,
  AUTH_PRESETS,
  AUTH_UNITS,
  type AuthFlavorId,
  type AuthPresetId,
  DEFAULT_AUTH_PRESET,
} from "../lib/wallet-config";
import { LAB_FEATURES, areaHref, featureHref } from "../lib/features";
import { cn } from "../lib/utils";

/**
 * Builds a URL carrying wallet-config overrides.
 *
 * Two axes are left: the sign-in preset and the email delivery flavor. Hosts
 * come from `.env` and the chain list from `lib/wallet-config.ts`, because
 * neither was ever varied per test and both cost more to explain than they
 * saved.
 *
 * The URL it emits is exactly what a Playwright spec would use, so the workflow
 * is: build it here, copy it, paste it into a test.
 */
export default function ConfigBuilderPage() {
  const searchParams = useSearchParams();
  const current = useMemo(
    () => resolveWalletConfig(searchParams),
    [searchParams],
  );

  // Read-only: the form doesn't edit transports, but it must not *drop* an
  // `rpc.<chainId>` param someone hand-wrote before landing here.
  const [rpcUrls] = useState<Record<number, string>>(() => {
    const seed: Record<number, string> = {};
    for (const chain of CHAINS) {
      seed[chain.id] = searchParams.get(`${PARAM.rpcPrefix}${chain.id}`) ?? "";
    }
    return seed;
  });
  // Seeded from the live resolution — URL, else stored, else default
  const { preset: activePreset, ready: presetReady } = useAuthPreset();
  const [presetOverride, setPresetOverride] = useState<AuthPresetId | null>(
    null,
  );
  const preset = presetOverride ?? activePreset;
  const [authFlavor, setAuthFlavor] = useState<AuthFlavorId>(
    current.authFlavor,
  );
  const [target, setTarget] = useState("/");
  const [copied, setCopied] = useState(false);

  const query = serializeOverrides({
    rpcUrls: Object.fromEntries(
      Object.entries(rpcUrls)
        .filter(([, url]) => url.trim())
        .map(([id, url]) => [Number(id), url.trim()]),
    ),
    preset,
    authFlavor,
  }).toString();

  const url = query ? `${target}?${query}` : target;

  const targets = [
    { href: "/", label: "/ (overview)" },
    ...LAB_FEATURES.flatMap((feature) =>
      feature.areas.length > 0
        ? feature.areas.map((area) => ({
            href: areaHref(feature.id, area.id),
            label: `${feature.name} · ${area.name}`,
          }))
        : [{ href: featureHref(feature), label: feature.name }],
    ),
    { href: "/environment", label: "/environment" },
  ];

  const apply = () => {
    // Full document load, not a client nav: the wagmi config is built once per
    // mount, so a soft navigation would leave the old connector in place.
    window.location.assign(url);
  };

  return (
    <div className="min-h-screen">
      <AppHeader />

      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
        <ConfigLink
          href="/"
          className="mb-4 inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border-warm)] bg-white px-3 text-xs font-semibold text-[#423a32] transition-colors hover:bg-[var(--surface-warm)] hover:text-[var(--ink)] sm:mb-6"
          data-testid="config-back-to-lab"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to QA Lab
        </ConfigLink>

        <div
          className="overflow-hidden rounded-lg border border-[var(--border-warm)] bg-white"
          data-testid="config-builder-card"
        >
          <div className="border-b border-[var(--border-warm)] bg-[var(--surface-warm)] px-4 py-3 sm:px-6">
            <h1 className="font-[var(--font-dm-sans)] text-sm font-bold text-[var(--ink)]">
              Wallet configuration
            </h1>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Everything here becomes a URL query param. Applying reloads the
              page — a new config means a new connector, so{" "}
              <span className="font-semibold">you will be signed out</span>.
            </p>
          </div>

          <div className="divide-y divide-[var(--border-warm)]">
            <Field label="sign-in preset" param={PARAM.preset}>
              <div
                role="radiogroup"
                aria-label="Sign-in preset"
                className="flex flex-col gap-2"
              >
                {AUTH_PRESET_IDS.map((id) => {
                  const selected = preset === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setPresetOverride(id)}
                      data-testid={`config-preset-${id}`}
                      data-selected={String(selected)}
                      className={cn(
                        "cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                        selected
                          ? "border-[var(--ink)] bg-[var(--surface-warm)]"
                          : "border-[var(--border-warm)] bg-white opacity-60 hover:border-[var(--ink)] hover:opacity-100",
                      )}
                    >
                      <p className="text-[11px] font-semibold text-[var(--ink)]">
                        <code className="font-mono">{id}</code> ·{" "}
                        {AUTH_PRESETS[id].label}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-4 text-[var(--muted)]">
                        {AUTH_PRESETS[id].description}
                      </p>
                      <ol className="mt-1.5 flex flex-col gap-0.5">
                        {AUTH_PRESETS[id].units.map((unit, index) => (
                          <li
                            key={unit}
                            data-testid={`config-preset-${id}-unit-${unit}`}
                            className="flex gap-2 font-mono text-[11px] leading-4 text-[var(--ink)]"
                          >
                            <span className="w-3 shrink-0 text-[var(--muted)]">
                              {index + 1}
                            </span>
                            {AUTH_UNITS[unit]}
                          </li>
                        ))}
                      </ol>
                    </button>
                  );
                })}
              </div>

              <p className="mt-2 text-[11px] leading-4 text-[var(--muted)]">
                <span className="font-semibold">This one persists:</span>{" "}
                opening the URL stores the preset, so later reloads without the
                param keep it. Use <span className="font-semibold">Clear stored
                preset</span> below to go back to{" "}
                <code className="font-mono">{DEFAULT_AUTH_PRESET}</code>.
              </p>
            </Field>

            <Field label="chains" param="— (all active)">
              <div className="flex flex-wrap gap-2">
                {CHAINS.map((chain, index) => (
                  <ReadOnlyChip
                    key={chain.id}
                    testId={`config-chain-${chain.id}`}
                    data-connects-to={String(index === 0)}
                  >
                    {chain.name}
                    <span className="text-[var(--muted)]">{chain.id}</span>
                    {index === 0 && (
                      <span className="font-sans text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                        connects here
                      </span>
                    )}
                  </ReadOnlyChip>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] leading-4 text-[var(--muted)]">
                All of these are configured. The first entry is the one the lab
                connects to on load; the rest are switchable in the app. Edit{" "}
                <code className="font-mono">CHAINS</code> in{" "}
                <code className="font-mono">src/app/lib/wallet-config.ts</code>{" "}
                to change the list or the order.
              </p>
            </Field>

            {/*
              One control, not two: the project and the email method have to
              agree. A project with both methods configured makes the SDK fall
              back to OTP, so a mismatch delivers the wrong thing silently.
            */}
            <Field label="auth flavor" param={PARAM.authFlavor}>
              <div className="flex flex-wrap gap-2">
                {AUTH_FLAVOR_IDS.map((flavor) => (
                  <Toggle
                    key={flavor}
                    checked={authFlavor === flavor}
                    onChange={() => setAuthFlavor(flavor)}
                    testId={`config-auth-flavor-${flavor}`}
                  >
                    {flavor}
                  </Toggle>
                ))}
              </div>
            </Field>

            <Field label="open at" param="—">
              <select
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                data-testid="config-target"
                className="w-full cursor-pointer rounded-lg border border-[var(--border-warm)] bg-white px-3 py-2 text-xs text-[var(--ink)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {targets.map((option) => (
                  <option key={option.href} value={option.href}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="border-t border-[var(--border-warm)] bg-[var(--surface-warm)] px-4 py-3 sm:px-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9c958c]">
              Generated URL
            </p>
            <code
              className="mt-1.5 block break-all font-mono text-xs text-[var(--ink)]"
              data-testid="config-generated-url"
            >
              {url}
            </code>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={apply}
                disabled={!presetReady}
                data-testid="config-apply"
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#2a1c13] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Open with this config
              </button>

              <button
                type="button"
                disabled={!presetReady}
                onClick={async () => {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                data-testid="config-copy-url"
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-warm)] bg-white px-4 text-xs font-semibold text-[#423a32] transition-colors hover:bg-[var(--surface-warm)]"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                Copy URL
              </button>

              <a
                href="/config"
                data-testid="config-reset"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border-warm)] bg-white px-4 text-xs font-semibold text-[#423a32] transition-colors hover:bg-[var(--surface-warm)]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to defaults
              </a>

              <button
                type="button"
                onClick={() => {
                  clearStoredPreset();
                  window.location.assign("/config");
                }}
                data-testid="config-clear-stored-preset"
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-warm)] bg-white px-4 text-xs font-semibold text-[#423a32] transition-colors hover:bg-[var(--surface-warm)]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear stored preset
              </button>
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs leading-6 text-[var(--muted)]">
          These params work on{" "}
          <span className="font-semibold">every route</span>, so you can append
          the query string to any URL by hand. In-app navigation carries them
          forward automatically.
        </p>

        <p className="mt-2 text-xs leading-6 text-[var(--muted)]">
          The auth flavor is per-URL; the sign-in preset persists once opened.
          To change what the app uses by{" "}
          <span className="font-semibold">default</span>, edit{" "}
          <code className="font-mono text-[11px]">
            src/app/lib/wallet-config.ts
          </code>{" "}
          (chains, presets, transport template) or{" "}
          <code className="font-mono text-[11px]">.env</code> (project ids, KMS
          proxy, AA host, WalletConnect) — see the app README.
        </p>
      </div>
    </div>
  );
}

/**
 * A value the page shows but cannot change — rendered as text, not a button.
 */
function ReadOnlyChip({
  testId,
  children,
  ...rest
}: {
  testId: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-testid={testId}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-warm)] bg-white px-2.5 py-1 font-mono text-xs font-semibold text-[var(--muted)]"
      {...rest}
    >
      {children}
    </span>
  );
}

function Field({
  label,
  param,
  children,
}: {
  label: string;
  param: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-6 sm:px-6">
      <div className="sm:w-56 sm:shrink-0">
        <p className="text-xs font-semibold text-[var(--ink)]">{label}</p>
        <p className="font-mono text-[10px] text-[var(--muted)]">{param}</p>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  testId,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      data-testid={testId}
      data-checked={String(checked)}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs font-semibold transition-colors",
        checked
          ? "border-[var(--ink)] bg-[var(--ink)] text-white"
          : "border-[var(--border-warm)] bg-white text-[var(--muted)] hover:text-[var(--ink)]",
      )}
    >
      {children}
    </button>
  );
}
