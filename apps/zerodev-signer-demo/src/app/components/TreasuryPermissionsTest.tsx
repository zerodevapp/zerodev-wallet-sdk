"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Ban,
  Check,
  ChevronDown,
  Code2,
  ExternalLink,
  Info,
  KeyRound,
  Loader2,
  Minus,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Square,
  UserRound,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import {
  type Address,
  type Hash,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseAbi,
  parseUnits,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "wagmi/chains";
import { useAccount, useConfig, usePublicClient } from "wagmi";
import { getZeroDevConnector, getZeroDevStore } from "@zerodev/wallet-react";
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from "@zerodev/sdk";
import { getEntryPoint, KERNEL_V3_3 } from "@zerodev/sdk/constants";
import {
  deserializePermissionAccount,
  serializePermissionAccount,
  toPermissionValidator,
} from "@zerodev/permissions";
import { toECDSASigner } from "@zerodev/permissions/signers";
import {
  CallPolicyVersion,
  ParamCondition,
  toCallPolicy,
  toRateLimitPolicy,
} from "@zerodev/permissions/policies";
import { cn } from "../lib/utils";
import { FaucetLink } from "./FaucetLink";

// Scoped to Arbitrum Sepolia, where the demo's USDC + paymaster live.
const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;
const USDC_ADDRESS: Address = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
const USDC_FAUCET_URL = "https://faucet.circle.com/";
const EXPLORER_BASE_URL = "https://sepolia.arbiscan.io";

const entryPoint = getEntryPoint("0.7");
const kernelVersion = KERNEL_V3_3;

const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);

// Example payout wallets — editable; the user picks how many to allow-list.
const EXAMPLE_RECIPIENTS: Address[] = [
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
  "0x4444444444444444444444444444444444444444",
  "0x5555555555555555555555555555555555555555",
];
const INITIAL_RECIPIENT_COUNT = 3;
const MIN_RECIPIENTS = 1;
const MAX_RECIPIENTS = EXAMPLE_RECIPIENTS.length; // 5

// Reasonable bounds for the demo inputs.
const AMOUNT_MIN = 0.01;
const AMOUNT_MAX = 10;
const COUNT_MIN = 1;
const COUNT_MAX = 20;
const INTERVAL_MIN = 1;
const INTERVAL_MAX = 60;

function clampNumber(raw: string, min: number, max: number, integer = false): string {
  let n = Number(raw);
  if (!Number.isFinite(n)) n = min;
  n = Math.min(max, Math.max(min, n));
  if (integer) n = Math.round(n);
  // Trim float noise (e.g. 0.30000000000000004) without forcing decimals.
  return integer ? String(n) : String(Number(n.toFixed(2)));
}

// Mirrors the connector's bundler/paymaster URL (getAAUrl isn't exported).
function getAaUrl(chainId: number) {
  const projectId = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID;
  return `https://staging-meta-aa-provider.onrender.com/api/v3/${projectId}/chain/${chainId}`;
}

function formatShort(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getErrorMessage(error: unknown) {
  if (!error) return "Something went wrong.";
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    for (const key of ["shortMessage", "details", "message"]) {
      const value = (error as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type GrantInfo = {
  serialized: string
  sessionPrivateKey: `0x${string}`
  sessionAddress: Address
  recipients: Address[]
  capRaw: string // per-payout cap, bigint serialized
  amountEach: string
  count: number // total payouts allowed (rate limit)
  intervalSec: number
  used?: number // payouts already consumed on-chain (persisted across reloads)
};

type PayoutRow = {
  id: number
  recipient: Address
  amount: string
  status: "pending" | "sent" | "rejected"
  hash?: `0x${string}`
  error?: string
};

export function TreasuryPermissionsTest({
  accountAddress,
}: {
  accountAddress: Address | null
}) {
  const { chain } = useAccount();
  const wagmiConfig = useConfig();
  const publicClient = usePublicClient({ chainId: chain?.id });

  const isArbitrumSepolia = chain?.id === ARBITRUM_SEPOLIA_CHAIN_ID;
  const owner = accountAddress;

  // Config
  const [amountEach, setAmountEach] = useState("0.05");
  const [payoutCount, setPayoutCount] = useState("5");
  const [intervalSec, setIntervalSec] = useState("3");
  const [recipients, setRecipients] = useState<string[]>(() =>
    EXAMPLE_RECIPIENTS.slice(0, INITIAL_RECIPIENT_COUNT),
  );

  const [usdcBalance, setUsdcBalance] = useState("0");

  // Session key + grant + drip state
  const [sessionKey, setSessionKey] = useState<{
    privateKey: `0x${string}`
    address: Address
  } | null>(null);
  const [grant, setGrant] = useState<GrantInfo | null>(null);
  const [granting, setGranting] = useState(false);
  const [running, setRunning] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [feed, setFeed] = useState<PayoutRow[]>([]);
  const [sentCount, setSentCount] = useState(0);
  const [revoking, setRevoking] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [revokeHash, setRevokeHash] = useState<Hash | undefined>(undefined);
  const [postRevokeAttempt, setPostRevokeAttempt] = useState<string | null>(null);
  const [tryingAfterRevoke, setTryingAfterRevoke] = useState(false);
  const [error, setError] = useState("");
  const [codeOpen, setCodeOpen] = useState(false);

  const runIdRef = useRef(0);
  const sentCountRef = useRef(0);
  useEffect(() => {
    sentCountRef.current = sentCount;
  }, [sentCount]);

  // Stop any running drip on unmount.
  useEffect(() => {
    return () => {
      runIdRef.current += 1;
    };
  }, []);

  const storageKey =
    owner && chain?.id ? `zd:treasury-session:${chain.id}:${owner.toLowerCase()}` : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as Partial<GrantInfo>) : null;
      // Only restore grants that match the current shape. Older versions wrote
      // grants without count/intervalSec, which would make the drip a no-op.
      if (
        parsed &&
        typeof parsed.serialized === "string" &&
        typeof parsed.sessionPrivateKey === "string" &&
        typeof parsed.count === "number" &&
        typeof parsed.intervalSec === "number" &&
        Array.isArray(parsed.recipients)
      ) {
        setGrant(parsed as GrantInfo);
        setSessionKey({
          privateKey: parsed.sessionPrivateKey,
          address: parsed.sessionAddress as Address,
        });
        setSentCount(Math.min(parsed.used ?? 0, parsed.count));
      } else {
        if (raw) window.localStorage.removeItem(storageKey);
        setGrant(null);
        setSessionKey(null);
        setSentCount(0);
      }
    } catch {
      setGrant(null);
      setSessionKey(null);
      setSentCount(0);
    }
  }, [storageKey]);

  // Persist the grant + how many payouts have been consumed, so an exhausted
  // key is recognized after a reload instead of failing the first payout.
  // Skipped once revoked so the header badge clears and stays cleared.
  useEffect(() => {
    if (!storageKey || !grant || revoked) return;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ ...grant, used: sentCount }),
    );
  }, [grant, sentCount, storageKey, revoked]);

  const loadBalance = useCallback(async () => {
    if (!owner || !publicClient || !isArbitrumSepolia) return;
    try {
      const balance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [owner],
      });
      setUsdcBalance(formatUnits(balance, 6));
    } catch {
      /* keep last known */
    }
  }, [owner, publicClient, isArbitrumSepolia]);

  useEffect(() => {
    loadBalance();
    const id = window.setInterval(loadBalance, 7000);
    return () => window.clearInterval(id);
  }, [loadBalance]);

  const normalizedRecipients = (): Address[] =>
    recipients.map((value) => {
      const trimmed = value.trim();
      if (!isAddress(trimmed)) {
        throw new Error(`"${trimmed || "(empty)"}" is not a valid address.`);
      }
      return getAddress(trimmed);
    });

  const updateRecipient = (index: number, value: string) => {
    setRecipients((current) => current.map((r, i) => (i === index ? value : r)));
  };

  const addRecipient = () => {
    setRecipients((current) =>
      current.length >= MAX_RECIPIENTS
        ? current
        : [...current, EXAMPLE_RECIPIENTS[current.length] ?? ""],
    );
  };

  const removeRecipient = () => {
    setRecipients((current) =>
      current.length <= MIN_RECIPIENTS ? current : current.slice(0, -1),
    );
  };

  // Scoped permission: only USDC.transfer, only to the allow-list, only up to the
  // per-payout cap, and only a fixed number of payouts total (rate limit).
  const buildPermissionPlugin = async (
    sessionPrivateKey: `0x${string}`,
    allowlist: Address[],
    capRaw: bigint,
    count: number,
  ) => {
    if (!publicClient) throw new Error("RPC client is not ready.");
    const sessionKeySigner = await toECDSASigner({
      signer: privateKeyToAccount(sessionPrivateKey),
    });
    const callPolicy = toCallPolicy({
      policyVersion: CallPolicyVersion.V0_0_4,
      permissions: [
        {
          target: USDC_ADDRESS,
          valueLimit: BigInt(0),
          abi: erc20Abi,
          functionName: "transfer",
          args: [
            { condition: ParamCondition.ONE_OF, value: allowlist },
            { condition: ParamCondition.LESS_THAN_OR_EQUAL, value: capRaw },
          ],
        },
      ],
    });
    // interval 0 => a total cap of `count` payouts (no reset window).
    const rateLimitPolicy = toRateLimitPolicy({ count, interval: 0 });
    return toPermissionValidator(publicClient, {
      entryPoint,
      kernelVersion,
      signer: sessionKeySigner,
      policies: [callPolicy, rateLimitPolicy],
    });
  };

  const buildSessionKeyAccount = async (
    sessionPrivateKey: `0x${string}`,
    allowlist: Address[],
    capRaw: bigint,
    count: number,
  ) => {
    if (!publicClient) throw new Error("RPC client is not ready.");
    const store = await getZeroDevStore(getZeroDevConnector(wagmiConfig));
    const ownerSigner = store.getState().eoaAccount;
    if (!ownerSigner) {
      throw new Error("Owner signer is not ready. Reconnect the wallet and try again.");
    }
    const permissionPlugin = await buildPermissionPlugin(
      sessionPrivateKey,
      allowlist,
      capRaw,
      count,
    );
    return createKernelAccount(publicClient, {
      entryPoint,
      kernelVersion,
      eip7702Account: ownerSigner,
      address: ownerSigner.address,
      plugins: { regular: permissionPlugin },
    });
  };

  const buildSessionClient = async (serialized: string) => {
    if (!publicClient) throw new Error("RPC client is not ready.");
    const account = await deserializePermissionAccount(
      publicClient,
      entryPoint,
      kernelVersion,
      serialized,
    );
    const aaUrl = getAaUrl(ARBITRUM_SEPOLIA_CHAIN_ID);
    const client = createKernelAccountClient({
      account,
      chain: arbitrumSepolia,
      bundlerTransport: http(aaUrl),
      paymaster: createZeroDevPaymasterClient({
        chain: arbitrumSepolia,
        transport: http(aaUrl),
      }),
    });
    return { account, client };
  };

  const resetAll = () => {
    runIdRef.current += 1;
    setSessionKey(null);
    setGrant(null);
    setRunning(false);
    setCountdown(0);
    setFeed([]);
    setSentCount(0);
    setRevoked(false);
    setRevokeHash(undefined);
    setPostRevokeAttempt(null);
    setError("");
    if (storageKey) window.localStorage.removeItem(storageKey);
  };

  // Step 1: generate the throwaway session key (no on-chain action yet).
  const createSessionKeyPair = () => {
    const privateKey = generatePrivateKey();
    const address = privateKeyToAccount(privateKey).address;
    const pair = { privateKey, address };
    setSessionKey(pair);
    return pair;
  };

  const handleCreateSessionKey = () => {
    setError("");
    // Starting a fresh key invalidates any prior grant/run (and stops the drip).
    runIdRef.current += 1;
    setRunning(false);
    setCountdown(0);
    setGrant(null);
    setFeed([]);
    setSentCount(0);
    setRevoked(false);
    setRevokeHash(undefined);
    setPostRevokeAttempt(null);
    if (storageKey) window.localStorage.removeItem(storageKey);
    createSessionKeyPair();
  };

  // Step 2: grant the scoped, rate-limited allowance to a session key.
  const grantWithKey = async (sessionPrivateKey: `0x${string}`, sessionAddress: Address) => {
    if (!owner || !isArbitrumSepolia) return;
    setError("");
    setRevokeHash(undefined);
    setRevoked(false);
    setPostRevokeAttempt(null);
    setFeed([]);
    setSentCount(0);
    setGranting(true);
    try {
      const allowlist = normalizedRecipients();
      const amt = clampNumber(amountEach, AMOUNT_MIN, AMOUNT_MAX);
      setAmountEach(amt);
      const capRaw = parseUnits(amt, 6);
      if (capRaw <= BigInt(0)) throw new Error("Set an amount greater than 0.");
      const count = Number(clampNumber(payoutCount, COUNT_MIN, COUNT_MAX, true));
      const interval = Number(clampNumber(intervalSec, INTERVAL_MIN, INTERVAL_MAX, true));
      setPayoutCount(String(count));
      setIntervalSec(String(interval));

      const sessionKeyAccount = await buildSessionKeyAccount(
        sessionPrivateKey,
        allowlist,
        capRaw,
        count,
      );
      // Owner signs ONCE here.
      const serialized = await serializePermissionAccount(
        sessionKeyAccount,
        sessionPrivateKey,
      );

      const next: GrantInfo = {
        serialized,
        sessionPrivateKey,
        sessionAddress,
        recipients: allowlist,
        capRaw: capRaw.toString(),
        amountEach: amt,
        count,
        intervalSec: interval,
      };
      setGrant(next);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setGranting(false);
    }
  };

  const handleGrant = async () => {
    if (!sessionKey) {
      setError("Create a session key first.");
      return;
    }
    await grantWithKey(sessionKey.privateKey, sessionKey.address);
  };

  // Wait `seconds`, updating the countdown; returns false if cancelled.
  const waitCountdown = async (seconds: number, myRun: number) => {
    for (let s = Math.max(0, Math.floor(seconds)); s > 0; s--) {
      if (runIdRef.current !== myRun) return false;
      setCountdown(s);
      await wait(1000);
    }
    setCountdown(0);
    return runIdRef.current === myRun;
  };

  const startDrip = async () => {
    if (!grant || running || revoked) return;
    const myRun = ++runIdRef.current;
    setRunning(true);
    setError("");
    try {
      const { client } = await buildSessionClient(grant.serialized);
      const amountRaw = BigInt(grant.capRaw);
      let attempt = sentCountRef.current;
      const maxAttempts = grant.count + 1; // N payouts + 1 overflow that proves the cap

      while (runIdRef.current === myRun && attempt < maxAttempts) {
        const proceed = await waitCountdown(grant.intervalSec, myRun);
        if (!proceed) break;

        const recipient = grant.recipients[attempt % grant.recipients.length];
        const rowId = attempt;
        setFeed((f) => [
          ...f,
          { id: rowId, recipient, amount: grant.amountEach, status: "pending" },
        ]);
        try {
          const hash = await client.sendTransaction({
            calls: [
              { to: USDC_ADDRESS, value: BigInt(0), data: encodeTransfer(recipient, amountRaw) },
            ],
          });
          if (runIdRef.current !== myRun) break;
          setFeed((f) =>
            f.map((r) => (r.id === rowId ? { ...r, status: "sent", hash } : r)),
          );
          setSentCount((c) => c + 1);
          await loadBalance();
        } catch (err) {
          if (runIdRef.current !== myRun) break;
          setFeed((f) =>
            f.map((r) =>
              r.id === rowId ? { ...r, status: "rejected", error: getErrorMessage(err) } : r,
            ),
          );
          break; // cap reached (or another rejection) — stop the drip
        }
        attempt++;
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      if (runIdRef.current === myRun) {
        setRunning(false);
        setCountdown(0);
      }
    }
  };

  const stopDrip = () => {
    runIdRef.current += 1;
    setRunning(false);
    setCountdown(0);
  };

  const handleRevoke = async () => {
    if (!grant) return;
    runIdRef.current += 1; // stop any drip
    setRunning(false);
    setCountdown(0);
    setError("");
    setRevoking(true);
    try {
      // The permission validator is installed on-chain only on the FIRST
      // successful payout. If the key was granted but never used, there's
      // nothing installed to uninstall (uninstall would revert) — discarding the
      // local key is the revoke.
      if (sentCount > 0) {
        const store = await getZeroDevStore(getZeroDevConnector(wagmiConfig));
        const ownerKernelClient = store
          .getState()
          .kernelClients.get(ARBITRUM_SEPOLIA_CHAIN_ID);
        if (!ownerKernelClient) {
          throw new Error("Owner smart-account client isn't ready. Reconnect and try again.");
        }
        const permissionPlugin = await buildPermissionPlugin(
          grant.sessionPrivateKey,
          grant.recipients,
          BigInt(grant.capRaw),
          grant.count,
        );
        const hash = await ownerKernelClient.uninstallPlugin({ plugin: permissionPlugin });
        setRevokeHash(hash);
      }
      setRevoked(true);
      // Clear the persisted grant so the header "active session key" badge goes
      // away. The in-memory grant stays for the "try a payout anyway" demo.
      if (storageKey) window.localStorage.removeItem(storageKey);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRevoking(false);
    }
  };

  const handleTryAfterRevoke = async () => {
    if (!grant) return;
    setTryingAfterRevoke(true);
    setPostRevokeAttempt(null);
    try {
      const { client } = await buildSessionClient(grant.serialized);
      try {
        await client.sendTransaction({
          calls: [
            {
              to: USDC_ADDRESS,
              value: BigInt(0),
              data: encodeTransfer(grant.recipients[0], BigInt(grant.capRaw)),
            },
          ],
        });
        setPostRevokeAttempt("Unexpected: the payout went through after revoke.");
      } catch (err) {
        setPostRevokeAttempt(getErrorMessage(err));
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setTryingAfterRevoke(false);
    }
  };

  const recipientTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of feed) {
      if (row.status !== "sent") continue;
      const key = row.recipient.toLowerCase();
      totals.set(key, (totals.get(key) ?? 0) + Number(row.amount));
    }
    return totals;
  }, [feed]);

  if (!isArbitrumSepolia) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-yellow-100 bg-yellow-50 px-4 py-3">
        <AlertCircle className="mt-0.5 h-4 w-4 text-yellow-600" />
        <p className="text-sm text-yellow-700">
          This permissions demo runs on Arbitrum Sepolia. Switch networks to continue.
        </p>
      </div>
    );
  }

  const balanceNumber = Number(usdcBalance) || 0;
  const needsFunding = balanceNumber <= 0;
  const granted = Boolean(grant);
  const keyCreated = Boolean(sessionKey);
  const sessionAddress = sessionKey?.address ?? grant?.sessionAddress ?? null;

  const activeRecipients = grant?.recipients ?? recipients;
  const amountNum = Number(grant?.amountEach ?? amountEach) || 0;
  const countNum = grant?.count ?? Math.max(1, Math.floor(Number(payoutCount) || 0));
  const totalBudget = amountNum * countNum;
  const spent = sentCount * amountNum;
  const progressPct = totalBudget > 0 ? Math.min(100, (spent / totalBudget) * 100) : 0;
  const dripComplete = granted && !running && sentCount >= countNum;
  const hasRejection = feed.some((row) => row.status === "rejected");
  // The key can no longer pay out: it hit the cap this run, or a payout was
  // rejected (e.g. an already-exhausted/invalid key). Either way the fix is a
  // new key, so prompt for one and stop Start from re-trying the dead key.
  const keySpent = granted && !running && !revoked && (dripComplete || hasRejection);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-950">Delegate a budget</h2>
        <p className="mt-1 text-sm leading-6 text-gray-600">
          Authorize a throwaway key to drip out a capped amount of <strong>your own</strong>{" "}
          USDC, on a timer, only to specific wallets. Watch it pay out by itself — then watch
          your account refuse the payout that would go over the limit, or kill it instantly by
          revoking.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <p className="break-words text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Flow diagram */}
      <FlowDiagram
        owner={owner}
        balance={balanceNumber}
        sessionAddress={sessionAddress}
        granted={granted}
        grant={grant}
        sentCount={sentCount}
        recipients={activeRecipients}
        recipientTotals={recipientTotals}
      />

      {/* Wallet balance + faucet */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium text-gray-600">
          <Wallet className="h-4 w-4 text-gray-500" />
          Your wallet&apos;s USDC
        </span>
        <span className="flex items-center gap-3">
          <span className="font-mono text-sm font-semibold text-gray-950">
            {balanceNumber.toFixed(2)} USDC
          </span>
          <FaucetLink
            href={USDC_FAUCET_URL}
            address={owner}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
          >
            Faucet
            <ExternalLink className="h-3 w-3" />
          </FaucetLink>
        </span>
      </div>
      {needsFunding && (
        <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            <p className="text-sm text-blue-700">
              You have no USDC yet. Grab some test USDC (clicking copies your wallet address so
              you can paste it into the faucet). This balance refreshes automatically.
            </p>
          </div>
          <FaucetLink
            href={USDC_FAUCET_URL}
            address={owner}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 cursor-pointer"
          >
            Get test USDC
            <ExternalLink className="h-3.5 w-3.5" />
          </FaucetLink>
        </div>
      )}

      {/* Step 1: create the session key */}
      <StepCard step={1} title="Create the session key">
        <p className="flex items-center gap-1.5 text-sm text-gray-600">
          A fresh throwaway key — it holds nothing and can&apos;t do anything until you grant it
          an allowance in Step 2.
          <InfoHint text="In production this is usually a key your backend holds, so it can keep acting for the user even while they're offline. Here it's generated in your browser for the demo." />
        </p>
        {!keyCreated ? (
          <button
            type="button"
            onClick={handleCreateSessionKey}
            disabled={!owner}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <KeyRound className="h-4 w-4" />
            Create session key
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <span className="flex items-center gap-2 text-sm">
                <KeyRound className="h-4 w-4 text-gray-500" />
                <span className="font-medium text-gray-700">Session key</span>
                <a
                  href={`${EXPLORER_BASE_URL}/address/${sessionAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs text-gray-950 underline-offset-2 hover:underline"
                >
                  {sessionAddress ? formatShort(sessionAddress) : "—"}
                  <ExternalLink className="h-3 w-3 text-gray-400" />
                </a>
              </span>
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                created
              </span>
            </div>
            <button
              type="button"
              onClick={handleCreateSessionKey}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900"
              title="Discard this key and generate a fresh one (you'll grant it again in Step 2)"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Swap to a new session key
            </button>
          </div>
        )}
      </StepCard>

      {/* Step 2: configure + grant */}
      <StepCard step={2} title="Set the allowance & grant" disabled={!keyCreated}>
        {!keyCreated && (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">
            Create a session key in Step 1 first.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-500">
              USDC per payout ({AMOUNT_MIN}–{AMOUNT_MAX})
            </span>
            <input
              type="number"
              min={AMOUNT_MIN}
              max={AMOUNT_MAX}
              step="0.01"
              value={amountEach}
              disabled={granted}
              onChange={(e) => setAmountEach(e.target.value)}
              onBlur={() => setAmountEach(clampNumber(amountEach, AMOUNT_MIN, AMOUNT_MAX))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm text-gray-950 outline-none focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">
              # of payouts ({COUNT_MIN}–{COUNT_MAX})
            </span>
            <input
              type="number"
              min={COUNT_MIN}
              max={COUNT_MAX}
              step="1"
              value={payoutCount}
              disabled={granted}
              onChange={(e) => setPayoutCount(e.target.value)}
              onBlur={() =>
                setPayoutCount(clampNumber(payoutCount, COUNT_MIN, COUNT_MAX, true))
              }
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm text-gray-950 outline-none focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">
              Every (sec, {INTERVAL_MIN}–{INTERVAL_MAX})
            </span>
            <input
              type="number"
              min={INTERVAL_MIN}
              max={INTERVAL_MAX}
              step="1"
              value={intervalSec}
              disabled={granted}
              onChange={(e) => setIntervalSec(e.target.value)}
              onBlur={() =>
                setIntervalSec(clampNumber(intervalSec, INTERVAL_MIN, INTERVAL_MAX, true))
              }
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm text-gray-950 outline-none focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </label>
        </div>

        <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          Total budget: <strong className="font-mono">{totalBudget} USDC</strong> ({countNum}{" "}
          payouts × {amountNum} USDC). The account enforces this hard cap on-chain.
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
              Allow-listed wallets
              <InfoHint text="Example payout wallets — edit them to addresses you control. Choose how many to allow-list (1–5). Only these can ever receive funds from the session key." />
            </span>
            {!granted && (
              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={removeRecipient}
                  disabled={recipients.length <= MIN_RECIPIENTS}
                  aria-label="Remove a wallet"
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-4 text-center font-mono text-xs text-gray-700">
                  {recipients.length}
                </span>
                <button
                  type="button"
                  onClick={addRecipient}
                  disabled={recipients.length >= MAX_RECIPIENTS}
                  aria-label="Add a wallet"
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
          </div>
          {recipients.map((recipient, index) => (
            <input
              key={index}
              value={recipient}
              disabled={granted}
              onChange={(e) => updateRecipient(index, e.target.value)}
              spellCheck={false}
              placeholder="0x..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs text-gray-950 outline-none focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-500"
            />
          ))}
        </div>

        {!granted ? (
          <button
            type="button"
            onClick={handleGrant}
            disabled={granting || !owner || !keyCreated}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {granting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Granting (you sign once)...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                Grant allowance to this key
              </>
            )}
          </button>
        ) : (
          <GrantSummary grant={grant!} sentCount={sentCount} revoked={revoked} />
        )}
      </StepCard>

      {/* Step 2: run the drip */}
      <StepCard step={3} title="Run the allowance drip" disabled={!granted}>
        {!granted && (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">
            Grant an allowance in Step 2 first to unlock the drip.
          </p>
        )}
        <p className="text-sm text-gray-600">
          The session key — not you — signs each payout on a timer, gas sponsored. It stops on
          its own when it hits the {countNum}-payout cap.
        </p>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              <span className="font-semibold text-gray-900">{spent.toFixed(2)}</span> /{" "}
              {totalBudget} USDC paid out
            </span>
            <span>
              {sentCount} / {countNum} payouts
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gray-900 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!running ? (
            <button
              type="button"
              onClick={startDrip}
              disabled={!granted || revoked || dripComplete || hasRejection}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Play className="h-4 w-4" />
              {sentCount > 0 ? "Resume drip" : "Start drip"}
            </button>
          ) : (
            <button
              type="button"
              onClick={stopDrip}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50"
            >
              <Square className="h-4 w-4" />
              Stop
            </button>
          )}
          {running && countdown > 0 && (
            <span className="inline-flex h-11 items-center gap-2 rounded-lg bg-gray-50 px-3 text-sm font-medium text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              next in {countdown}s
            </span>
          )}
        </div>

        {keySpent && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>
              <strong>This session key can&apos;t pay out anymore.</strong>{" "}
              {dripComplete
                ? `It hit its ${countNum}-payout cap.`
                : "Its allowance is used up (or the key is no longer valid)."}{" "}
              A rate-limited key can&apos;t be topped up — use <strong>Revoke</strong> or{" "}
              <strong>Reset</strong> in Step 4 to start over with a new key.
            </span>
          </div>
        )}

        {/* Live feed */}
        {feed.length > 0 && (
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {feed.map((row) => {
              const isLimitHit = row.status === "rejected" && row.id >= countNum;
              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-mono text-xs text-gray-400">#{row.id + 1}</span>
                    <span className="font-mono text-xs text-gray-700">
                      {formatShort(row.recipient)}
                    </span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-500">{row.amount} USDC</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {row.status === "pending" && (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    )}
                    {row.status === "sent" && row.hash && (
                      <a
                        href={`${EXPLORER_BASE_URL}/tx/${row.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-emerald-700 underline-offset-2 hover:underline"
                        title="Signed by the session key"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {formatShort(row.hash)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {row.status === "rejected" && (
                      <span className="text-xs font-semibold text-red-600">
                        {isLimitHit ? "Cap reached — rejected" : "Rejected"}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </StepCard>

      {/* Step 3: revoke + reset */}
      <StepCard step={4} title="Revoke & reset" disabled={!granted}>
        <p className="text-sm text-gray-600">
          Kill the session key on-chain at any time. Even mid-drip, the next payout is refused.
        </p>

        {revokeHash && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              Revoked on-chain.{" "}
              <a
                href={`${EXPLORER_BASE_URL}/tx/${revokeHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline underline-offset-2"
              >
                View transaction
              </a>
            </span>
          </div>
        )}

        {revoked && !revokeHash && (
          <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            <Ban className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
            <span>
              Key discarded. It was never used, so nothing was installed on-chain to revoke —
              your local copy is gone.
            </span>
          </div>
        )}

        {revoked && postRevokeAttempt && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            <p className="font-semibold">Payout after revoke — rejected by the account</p>
            <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-white/70 p-2 font-mono text-[11px] leading-4 text-gray-700">
              {postRevokeAttempt}
            </pre>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          {!revoked ? (
            <button
              type="button"
              onClick={handleRevoke}
              disabled={!granted || revoking}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {revoking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Revoking on-chain...
                </>
              ) : (
                <>
                  <Ban className="h-4 w-4" />
                  Revoke session key
                </>
              )}
            </button>
          ) : revokeHash ? (
            <button
              type="button"
              onClick={handleTryAfterRevoke}
              disabled={tryingAfterRevoke}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              {tryingAfterRevoke ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 text-red-500" />
              )}
              Try a payout anyway
            </button>
          ) : null}
          <button
            type="button"
            onClick={resetAll}
            disabled={revoking}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
            title="Clear this page (no on-chain transaction)"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </StepCard>

      <CodePanel open={codeOpen} onToggle={() => setCodeOpen((o) => !o)} />
    </div>
  );
}

function FlowDiagram({
  owner,
  balance,
  sessionAddress,
  granted,
  sentCount,
  recipients,
  recipientTotals,
}: {
  owner: Address | null
  balance: number
  sessionAddress: string | null
  granted: boolean
  grant: GrantInfo | null
  sentCount: number
  recipients: string[]
  recipientTotals: Map<string, number>
}) {
  return (
    <div className="grid items-stretch gap-3 rounded-lg border border-gray-200 bg-white p-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
      {/* You */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
          <UserRound className="h-3.5 w-3.5" />
          You (this wallet)
        </p>
        <p className="mt-1 font-mono text-xs font-semibold text-gray-950">
          {owner ? formatShort(owner) : "—"}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Holds <span className="font-mono">{balance.toFixed(2)} USDC</span> · signs once
        </p>
      </div>

      <FlowArrow />

      {/* Session key */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
          <KeyRound className="h-3.5 w-3.5" />
          Session key
          <InfoHint text="In production this is usually a key your backend holds, so it can keep acting for the user even while they're offline. Here it's generated in your browser just for the demo." />
        </p>
        {sessionAddress ? (
          <>
            <a
              href={`${EXPLORER_BASE_URL}/address/${sessionAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 font-mono text-xs font-semibold text-gray-950 underline-offset-2 hover:underline"
            >
              {formatShort(sessionAddress)}
              <ExternalLink className="h-3 w-3 text-gray-400" />
            </a>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ring-gray-200">
                0 ETH · 0 USDC
              </span>
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                gas sponsored
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {granted ? `signed ${sentCount} payouts` : "no allowance yet — grant one"}
            </p>
          </>
        ) : (
          <p className="mt-1 text-xs text-gray-400">created in Step 1 →</p>
        )}
      </div>

      <FlowArrow />

      {/* Recipients */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
          <Users className="h-3.5 w-3.5" />
          Recipients
          <InfoHint text="Example payout wallets. Edit them to addresses you control and pick how many to allow-list — the session key can only ever send to these." />
        </p>
        <ul className="mt-1 space-y-0.5">
          {recipients.slice(0, 4).map((r) => {
            const received = recipientTotals.get(r.toLowerCase()) ?? 0;
            return (
              <li key={r} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono text-gray-700">{formatShort(r)}</span>
                <span className={cn("font-mono", received > 0 ? "text-emerald-700" : "text-gray-400")}>
                  +{received.toFixed(2)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function InfoHint({ text }: { text: string }) {
  return (
    <span className="group/info relative inline-flex">
      <Info className="h-3.5 w-3.5 cursor-help text-gray-400" />
      <span className="pointer-events-none absolute left-0 top-full z-30 mt-1.5 hidden w-56 max-w-[calc(100vw-2.5rem)] rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-normal leading-4 text-gray-600 shadow-md group-hover/info:block">
        {text}
      </span>
    </span>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center text-gray-300">
      <ArrowRight className="hidden h-5 w-5 lg:block" />
      <ArrowRight className="h-5 w-5 rotate-90 lg:hidden" />
    </div>
  );
}

function StepCard({
  step,
  title,
  children,
  disabled = false,
}: {
  step: number
  title: string
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-gray-200 bg-white p-4 transition-opacity",
        disabled && "opacity-50",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white",
            disabled ? "bg-gray-300" : "bg-gray-950",
          )}
        >
          {step}
        </span>
        <h3 className="text-sm font-semibold text-gray-950">{title}</h3>
      </div>
      <div
        className={cn("mt-4 space-y-4", disabled && "pointer-events-none select-none")}
        aria-disabled={disabled}
      >
        {children}
      </div>
    </div>
  );
}

function GrantSummary({
  grant,
  sentCount,
  revoked,
}: {
  grant: GrantInfo
  sentCount: number
  revoked: boolean
}) {
  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border p-3",
        revoked ? "border-gray-200 bg-gray-50" : "border-emerald-200 bg-emerald-50/60",
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        {revoked ? (
          <>
            <Ban className="h-4 w-4 text-gray-500" />
            <span className="text-gray-700">Permission revoked</span>
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span className="text-emerald-900">Allowance granted</span>
          </>
        )}
      </div>
      <p className="text-xs leading-5 text-gray-600">
        The session key may call <span className="font-mono">USDC.transfer</span> up to{" "}
        <strong>{grant.amountEach} USDC</strong> per payout, only to the{" "}
        {grant.recipients.length} allow-listed wallets, for at most{" "}
        <strong>{grant.count} payouts</strong>. You signed once; the key has signed {sentCount}.
      </p>
    </div>
  );
}

function CodePanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 bg-gray-950 px-4 py-3 text-left text-white transition-colors hover:bg-gray-900"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Code2 className="h-4 w-4 text-gray-300" />
          Code
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-gray-300 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          <CodeBlock label="Grant a scoped, rate-limited session key">{GRANT_SNIPPET}</CodeBlock>
        </div>
      )}
    </div>
  );
}

function CodeBlock({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-950">
      <div className="border-b border-white/10 px-3 py-2 text-xs font-semibold text-gray-300">
        {label}
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-5 text-gray-100">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function encodeTransfer(to: Address, amount: bigint): `0x${string}` {
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, amount],
  });
}

const GRANT_SNIPPET = `const permission = await toPermissionValidator(publicClient, {
  entryPoint, kernelVersion,
  signer: await toECDSASigner({ signer: sessionKey }),
  policies: [
    toCallPolicy({
      policyVersion: CallPolicyVersion.V0_0_4,
      permissions: [{
        target: USDC, abi: erc20Abi, functionName: "transfer",
        args: [
          { condition: ParamCondition.ONE_OF, value: recipients },
          { condition: ParamCondition.LESS_THAN_OR_EQUAL, value: cap },
        ],
      }],
    }),
    // hard cap of N payouts total (interval 0 = no reset)
    toRateLimitPolicy({ count: N, interval: 0 }),
  ],
})

const account = await createKernelAccount(publicClient, {
  entryPoint, kernelVersion,
  eip7702Account: owner, address: owner.address,
  plugins: { regular: permission },
})

const approval = await serializePermissionAccount(account, sessionPrivateKey)`;
