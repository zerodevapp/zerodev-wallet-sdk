"use client";

import { ArrowLeft, Check, Copy, RotateCcw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { WalletMode } from "@zerodev/wallet-react";
import { AppHeader } from "../components/AppHeader";
import { ConfigLink } from "../components/ConfigLink";
import {
  AUTH_METHODS,
  type AuthMethodId,
  CHAIN_CATALOG,
  PARAM,
  resolveWalletConfig,
  serializeOverrides,
  WALLET_MODES,
} from "../lib/config-params";
import { AUTH_FLAVOR_IDS, type AuthFlavorId } from "../lib/wallet-config";
import { LAB_FEATURES, areaHref, featureHref } from "../lib/features";
import { cn } from "../lib/utils";

/**
 * Builds a URL carrying wallet-config overrides.
 *
 * The page holds no wallet state and persists nothing — it turns a form into a
 * query string. That's the whole safety story: a bad value can't be sticky, so
 * it can never brick the app the way a persisted override could.
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

  const [kms, setKms] = useState(searchParams.get(PARAM.kms) ?? "");
  const [aaHost, setAaHost] = useState(searchParams.get(PARAM.aaHost) ?? "");
  const [chainIds, setChainIds] = useState<number[]>(
    current.chains.map((chain) => chain.id),
  );
  // Read-only: the form doesn't edit transports, but it must not *drop* an
  // `rpc.<chainId>` param someone hand-wrote before landing here.
  const [rpcUrls] = useState<Record<number, string>>(() => {
    const seed: Record<number, string> = {};
    for (const chain of CHAIN_CATALOG) {
      seed[chain.id] = searchParams.get(`${PARAM.rpcPrefix}${chain.id}`) ?? "";
    }
    return seed;
  });
  const [authMethods, setAuthMethods] = useState<AuthMethodId[]>(
    current.authMethods,
  );
  const [authFlavor, setAuthFlavor] = useState<AuthFlavorId>(
    current.authFlavor,
  );
  const [mode, setMode] = useState<WalletMode>(current.mode);
  const [target, setTarget] = useState("/");
  const [copied, setCopied] = useState(false);

  const query = serializeOverrides({
    kms: kms.trim() || undefined,
    aaHost: aaHost.trim() || undefined,
    chainIds,
    rpcUrls: Object.fromEntries(
      Object.entries(rpcUrls)
        .filter(([id, url]) => url.trim() && chainIds.includes(Number(id)))
        .map(([id, url]) => [Number(id), url.trim()]),
    ),
    authMethods,
    authFlavor,
    mode,
  }).toString();

  const url = query ? `${target}?${query}` : target;

  // wagmi types chains as a non-empty tuple, and with no auth method there is
  // no way to sign in. Both are rejected by the parser too, since URLs get
  // hand-edited — this just stops you generating a broken one.
  const errors = [
    chainIds.length === 0 && "Select at least one chain.",
    authMethods.length === 0 && "Select at least one auth method.",
  ].filter(Boolean) as string[];

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

  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value)
      ? list.filter((item) => item !== value)
      : [...list, value];

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
              Everything here becomes a URL query param. Blank means &ldquo;use
              the default&rdquo;. Applying reloads the page — a new config means
              a new connector, so{" "}
              <span className="font-semibold">you will be signed out</span>.
            </p>
          </div>

          <div className="divide-y divide-[var(--border-warm)]">
            <Field label="kms proxy base url" param={PARAM.kms}>
              <input
                type="text"
                value={kms}
                onChange={(event) => setKms(event.target.value)}
                placeholder="(env default)"
                spellCheck={false}
                data-testid="config-kms"
                className="w-full rounded-lg border border-[var(--border-warm)] px-3 py-2 font-mono text-xs text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>

            <Field label="aa host" param={PARAM.aaHost}>
              <input
                type="text"
                value={aaHost}
                onChange={(event) => setAaHost(event.target.value)}
                placeholder="(env default)"
                spellCheck={false}
                data-testid="config-aa-host"
                className="w-full rounded-lg border border-[var(--border-warm)] px-3 py-2 font-mono text-xs text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>

            <Field label="chains" param={PARAM.chains}>
              <div className="flex flex-wrap gap-2">
                {CHAIN_CATALOG.map((chain) => (
                  <Toggle
                    key={chain.id}
                    checked={chainIds.includes(chain.id)}
                    onChange={() => setChainIds(toggle(chainIds, chain.id))}
                    testId={`config-chain-${chain.id}`}
                  >
                    {chain.name}
                    <span className="text-[var(--muted)]">{chain.id}</span>
                  </Toggle>
                ))}
              </div>
            </Field>

            {/*
              Transports are deliberately not editable here. Selected chains
              default to the ZeroDev staging RPC (localhost for Anvil), which
              covers every case we have. The `rpc.<chainId>` param still works
              if you hand-write a URL — see the README.
            */}

            <Field label="auth methods" param={PARAM.authMethods}>
              <div className="flex flex-wrap gap-2">
                {AUTH_METHODS.map((method) => (
                  <Toggle
                    key={method}
                    checked={authMethods.includes(method)}
                    onChange={() =>
                      setAuthMethods(toggle(authMethods, method))
                    }
                    testId={`config-auth-method-${method}`}
                  >
                    {method}
                  </Toggle>
                ))}
              </div>
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

            {/*
              `4337` makes the connector expose the Kernel address instead of
              the EOA. That is the address the transaction history harness
              sends as the wallet address.
            */}
            <Field label="wallet mode" param={PARAM.mode}>
              <div className="flex flex-wrap gap-2">
                {WALLET_MODES.map((value) => (
                  <Toggle
                    key={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                    testId={`config-mode-${value}`}
                  >
                    {value}
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

            {errors.length > 0 && (
              <ul
                className="mt-2 list-disc pl-4 text-xs text-red-700"
                data-testid="config-errors"
              >
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={apply}
                disabled={errors.length > 0}
                data-testid="config-apply"
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#2a1c13] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Open with this config
              </button>

              <button
                type="button"
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
          This page only changes the current session. To change what the app
          uses by <span className="font-semibold">default</span>, edit{" "}
          <code className="font-mono text-[11px]">
            src/app/lib/wallet-config.ts
          </code>{" "}
          (chains, auth methods, transport template) or{" "}
          <code className="font-mono text-[11px]">.env</code> (project id, KMS
          proxy, AA host) — see the app README.
        </p>
      </div>
    </div>
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
