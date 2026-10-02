import { AlertTriangle, ArrowLeft, Check, SlidersHorizontal, X } from "lucide-react";
import { AppHeader } from "../components/AppHeader";
import { ConfigLink } from "../components/ConfigLink";
import {
  PARAM,
  resolveWalletConfig,
  toURLSearchParams,
  type TransportSource,
} from "../lib/config-params";
import { AuthPresetRow } from "./AuthPresetRow";

export const dynamic = "force-dynamic";

/**
 * A rendered check: whether it passed, and the short label shown in the pill.
 */
type CheckResult = { pass: boolean; label: string };

const isSet = (value?: string): CheckResult => {
  const pass = Boolean(value?.trim());
  return { pass, label: String(pass) };
};

const containsStaging = (value?: string): CheckResult => {
  const pass = Boolean(value?.toLowerCase().includes("staging"));
  return { pass, label: pass ? "staging" : "not staging" };
};

/** Where each chain's transport came from. Values themselves stay hidden. */
const TRANSPORT_SOURCE_LABEL: Record<TransportSource, string> = {
  param: "from URL",
  default: "zerodev staging",
  local: "local node",
  chain: "chain default",
};

/**
 * Environment diagnostics.
 *
 * Two cards with deliberately different meanings:
 *
 * - **Environment** — what the *server's* env vars say. Values never rendered,
 *   only pass/fail, so the page is safe to screenshot into a bug report.
 * - **Wallet configuration** — what the app is *actually running with*, after
 *   URL overrides are applied. Resolved from `searchParams` using the same
 *   function `Providers` uses, so it cannot disagree with the live config.
 *
 * That distinction is the whole point: with overrides in play, the env vars are
 * no longer the answer to "what is this app configured with".
 */
export default async function EnvironmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = toURLSearchParams(await searchParams);
  const resolved = resolveWalletConfig(params);
  const isOverridden = (param: string) => resolved.applied.includes(param);

  const checks = [
    {
      variable: "NEXT_PUBLIC_ZD_PROJECT_ID",
      result: isSet(process.env.NEXT_PUBLIC_ZD_PROJECT_ID),
    },
    {
      variable: "NEXT_PUBLIC_ZD_OTP_PROJECT_ID",
      result: isSet(process.env.NEXT_PUBLIC_ZD_OTP_PROJECT_ID),
    },
    {
      variable: "NEXT_PUBLIC_KMS_PROXY_BASE_URL",
      result: containsStaging(process.env.NEXT_PUBLIC_KMS_PROXY_BASE_URL),
    },
    {
      variable: "NEXT_PUBLIC_ZERODEV_AA_HOST",
      result: containsStaging(process.env.NEXT_PUBLIC_ZERODEV_AA_HOST),
    },
    {
      variable: "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
      result: isSet(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID),
    },
  ];

  return (
    <div className="min-h-screen">
      <AppHeader />

      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center gap-2 sm:mb-6">
          <ConfigLink
            href="/"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border-warm)] bg-white px-3 text-xs font-semibold text-[#423a32] transition-colors hover:bg-[var(--surface-warm)] hover:text-[var(--ink)]"
            data-testid="env-back-to-lab"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to QA Lab
          </ConfigLink>

          <ConfigLink
            href="/config"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--ink)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#2a1c13]"
            data-testid="env-open-config-builder"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Change configuration
          </ConfigLink>
        </div>

        {resolved.warnings.length > 0 && (
          <div
            className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800"
            data-testid="env-config-warnings"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="text-sm leading-6">
              <p className="font-semibold">
                Some config params were rejected and fell back to defaults.
              </p>
              <ul className="mt-1 list-disc pl-4">
                {resolved.warnings.map((warning) => (
                  <li key={warning} className="font-mono text-xs">
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div
          className="overflow-hidden rounded-lg border border-[var(--border-warm)] bg-white"
          data-testid="env-checks-card"
        >
          <div className="border-b border-[var(--border-warm)] bg-[var(--surface-warm)] px-4 py-3 sm:px-6">
            <h1
              className="font-[var(--font-dm-sans)] text-sm font-bold text-[var(--ink)]"
              data-testid="env-checks-heading"
            >
              Environment
            </h1>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              What the server&apos;s env vars say. Values are never shown — only
              whether each condition holds. URL overrides do not change these;
              see the card below for what the app is actually using.
            </p>
          </div>

          <table className="w-full border-collapse text-left" data-testid="env-table">
            <thead>
              <tr className="border-b border-[var(--border-warm)]">
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-6">
                  Variable
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-6">
                  Result
                </th>
              </tr>
            </thead>
            <tbody>
              {checks.map(({ variable, result }) => (
                <tr
                  key={variable}
                  className="border-b border-[var(--border-warm)] last:border-b-0"
                  data-testid={`env-row-${variable}`}
                >
                  <td className="px-4 py-3 font-mono text-xs font-semibold break-all text-[var(--ink)] sm:px-6 sm:text-sm">
                    {variable}
                  </td>
                  <td className="px-4 py-3 text-right sm:px-6">
                    <ResultPill result={result} testId={`env-${variable}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
          <span className="font-semibold">not staging</span> means the URL
          doesn&apos;t contain the word — production, local, or unset.
        </p>

        <div
          className="mt-6 overflow-hidden rounded-lg border border-[var(--border-warm)] bg-white"
          data-testid="env-config-card"
        >
          <div className="border-b border-[var(--border-warm)] bg-[var(--surface-warm)] px-4 py-3 sm:px-6">
            <h2
              className="font-[var(--font-dm-sans)] text-sm font-bold text-[var(--ink)]"
              data-testid="env-config-heading"
            >
              Wallet configuration
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Effective values, resolved from the URL with the same function the
              app uses — so this can&apos;t disagree with what&apos;s running.
              An <span className="font-semibold">overridden</span> tag means a
              query param set it.
            </p>
          </div>

          <dl className="divide-y divide-[var(--border-warm)]">
            <ConfigRow id="chains" label="chains">
              {resolved.chains.map((chain, index) => (
                <Chip
                  key={chain.id}
                  testId={`env-chain-${chain.id}`}
                  data-connects-to={String(index === 0)}
                >
                  {chain.name}
                  <span className="text-[var(--muted)]">{chain.id}</span>
                  {index === 0 && (
                    <span className="font-sans text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      connects here
                    </span>
                  )}
                </Chip>
              ))}
            </ConfigRow>

            <ConfigRow id="transports" label="transports">
              {resolved.chains.map((chain) => {
                const source = resolved.rpcSources[chain.id] ?? "chain";
                const explicit = source !== "chain";
                return (
                  <Chip
                    key={chain.id}
                    testId={`env-transport-${chain.id}`}
                    tone={explicit ? "pass" : "neutral"}
                    data-explicit={String(explicit)}
                    data-source={source}
                  >
                    {chain.name}
                    <span className={explicit ? "" : "text-[var(--muted)]"}>
                      {TRANSPORT_SOURCE_LABEL[source]}
                    </span>
                  </Chip>
                );
              })}
            </ConfigRow>

            <ConfigRow
              id="auth-preset"
              label="sign-in preset"
              overridden={isOverridden(PARAM.preset)}
            >
              <AuthPresetRow urlPreset={resolved.authPreset} />
            </ConfigRow>

            <ConfigRow
              id="auth-flavor"
              label="auth flavor"
              overridden={isOverridden(PARAM.authFlavor)}
            >
              <Chip testId={`env-auth-flavor-${resolved.authFlavor}`}>
                {resolved.authFlavor}
              </Chip>
              <Chip
                testId="env-auth-flavor-project"
                tone={resolved.projectId ? "pass" : "neutral"}
              >
                {resolved.projectId
                  ? "project id set"
                  : "project id MISSING"}
              </Chip>
            </ConfigRow>

            <ConfigRow id="kms" label="kms proxy base url">
              <Chip
                testId="env-kms"
                tone={resolved.kmsProxyBaseUrl ? "pass" : "neutral"}
              >
                {resolved.kmsProxyBaseUrl ? "from env" : "MISSING"}
              </Chip>
            </ConfigRow>

            <ConfigRow id="aa-host" label="aa host">
              <Chip
                testId="env-aa-host"
                tone={resolved.aaHost ? "pass" : "neutral"}
              >
                {resolved.aaHost ? "from env" : "SDK default"}
              </Chip>
            </ConfigRow>
          </dl>
        </div>

        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
          Transports default to <span className="font-semibold">zerodev staging</span>{" "}
          (localhost for Anvil). <span className="font-semibold">chain default</span>{" "}
          means even that was unavailable — no project id — so viem&apos;s public
          RPC is used, which is fine for reads and rate-limited under load. Host
          values stay hidden; only their source is shown.
        </p>
      </div>
    </div>
  );
}

function ConfigRow({
  id,
  label,
  overridden = false,
  children,
}: {
  /** Slug driving this row's test IDs, e.g. `chains` -> `env-chains`. */
  id: string;
  label: string;
  overridden?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6"
      data-testid={`env-config-row-${id}`}
      data-overridden={String(overridden)}
    >
      <dt
        className="flex items-center gap-2 font-mono text-xs font-semibold text-[var(--ink)] sm:text-sm"
        data-testid={`env-config-label-${id}`}
      >
        {label}
        {overridden && (
          <span className="rounded-full border border-blue-100 bg-blue-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-blue-700">
            overridden
          </span>
        )}
      </dt>
      <dd className="flex flex-wrap gap-1.5 sm:justify-end" data-testid={`env-${id}`}>
        {children}
      </dd>
    </div>
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

function ResultPill({
  result,
  testId,
}: {
  result: CheckResult;
  testId: string;
}) {
  const Icon = result.pass ? Check : X;

  return (
    <span
      data-testid={testId}
      data-pass={String(result.pass)}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs font-semibold ${
        result.pass
          ? "border-green-100 bg-green-50 text-green-700"
          : "border-red-100 bg-red-50 text-red-700"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {result.label}
    </span>
  );
}
