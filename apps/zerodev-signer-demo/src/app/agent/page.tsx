"use client"

// Demo: an auto-claim app. The user turns it on once by granting a server
// wallet a scoped permission; the agent then claims on a schedule. The
// server is stateless: this page holds the grant (via the wallet's own
// record) and asks the server to act every 45s while it is open.
import { ZeroDevLogo } from '@zerodev/react-ui'
import {
  type GrantedPermission,
  type GrantPermissionsParameters,
  toErc7715Request,
  useGrantedPermissions,
  useGrantPermissions,
  useRevokePermissions,
  ZERODEV_ARG_RULES,
} from '@zerodev/wallet-react'
import { ConnectWallet, SignatureRequest } from '@zerodev/wallet-react-ui'
import {
  ArrowLeft,
  Bot,
  Check,
  Clock,
  ExternalLink,
  KeyRound,
  Loader2,
  Power,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Wallet,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import { arbitrumSepolia } from 'viem/chains'
import { erc7715Actions } from 'viem/experimental'
import { useAccount, useWalletClient } from 'wagmi'
import Link from 'next/link'
import { AppHeader } from '../components/AppHeader'
import { NFT_ABI, NFT_ADDRESS } from '../lib/spike-constants'
import { cn } from '../lib/utils'

export const dynamic = 'force-dynamic'

const EXPLORER = 'https://sepolia.arbiscan.io/tx/'
const MINT_SIGNATURE = 'function mint(address _to)'
const HOUR = 3600
const TICK_MS = 45_000
// Keeps a forgotten tab from minting forever on staging.
const MAX_CLAIMS = 10

type ActivityEvent = {
  at: number
  kind: 'claimed' | 'blocked' | 'expired' | 'error' | 'started' | 'stopped'
  text: string
  txHash?: string
}

type TickResult =
  | { ok: true; account: Address; transactionHash: string }
  | { ok: false; kind: 'denied' | 'expired' | 'error'; reason?: string; message: string }

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const nowSeconds = () => Math.floor(Date.now() / 1000)

function ago(ms: number) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  return `${Math.round(s / 60)}m ago`
}

// Per-user page memory: whether auto-claim is on, and the activity log.
function usePersisted<T>(key: string | null, initial: T) {
  const [value, setValue] = useState<T>(initial)
  useEffect(() => {
    if (!key) return
    try {
      const raw = localStorage.getItem(key)
      setValue(raw ? (JSON.parse(raw) as T) : initial)
    } catch {
      setValue(initial)
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: reload only when the key changes
  }, [key])
  const update = useCallback(
    (next: T | ((prev: T) => T)) =>
      setValue((prev) => {
        const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          if (key) localStorage.setItem(key, JSON.stringify(v))
        } catch {}
        return v
      }),
    [key],
  )
  return [value, update] as const
}

export default function AutoClaimPage() {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const grant = useGrantPermissions()
  const revoke = useRevokePermissions()
  // The wallet's own record of what it granted, checked against the chain.
  const granted = useGrantedPermissions({ query: { enabled: isConnected } })

  const [agentAddress, setAgentAddress] = useState<Address | null>(null)
  const [pending, setPending] = useState<GrantPermissionsParameters | null>(null)
  const [granting, setGranting] = useState(false)
  const [grantError, setGrantError] = useState<string | null>(null)
  const [rogueBusy, setRogueBusy] = useState(false)
  const [running, setRunning] = useState(false)
  const [nextAt, setNextAt] = useState<number | null>(null)
  const [, setNow] = useState(0)

  const storageKey = address ? `autoclaim:${address.toLowerCase()}` : null
  const [on, setOn] = usePersisted<boolean>(storageKey && `${storageKey}:on`, false)
  const [events, setEvents] = usePersisted<ActivityEvent[]>(storageKey && `${storageKey}:events`, [])

  useEffect(() => {
    fetch('/api/agent')
      .then((r) => r.json())
      .then((j) => (j.agentAddress ? setAgentAddress(j.agentAddress) : setGrantError(j.error)))
  }, [])

  useEffect(() => {
    const clock = setInterval(() => setNow((n) => n + 1), 1000)
    return () => clearInterval(clock)
  }, [])

  // The newest usable grant this wallet gave the agent.
  const agentGrant = (granted.data ?? [])
    .filter((p) => agentAddress && p.signer.toLowerCase() === agentAddress.toLowerCase())
    .sort((a, b) => b.grantedAt - a.grantedAt)[0]
  const expiresIn = agentGrant ? agentGrant.expiry - nowSeconds() : null
  const claims = events.filter((e) => e.kind === 'claimed').length

  const log = useCallback(
    (e: Omit<ActivityEvent, 'at'>) =>
      setEvents((prev) => [{ at: Date.now(), ...e }, ...prev].slice(0, 30)),
    [setEvents],
  )

  // Latest values for the scheduler without restarting it.
  const latest = useRef({ agentGrant, address, claims })
  latest.current = { agentGrant, address, claims }

  const tick = useCallback(
    async (action: 'claim' | 'rogue'): Promise<TickResult | null> => {
      const { agentGrant: g, address: user } = latest.current
      if (!g || !user) return null
      const r = await fetch('/api/agent/tick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionsContext: g.permissionsContext, user, action }),
      })
      return (await r.json()) as TickResult
    },
    [],
  )

  // The agent's schedule: first claim right away, then every 45s.
  useEffect(() => {
    if (!on || !agentGrant) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const run = async () => {
      if (cancelled) return
      setRunning(true)
      setNextAt(null)
      try {
        const result = await tick('claim')
        if (cancelled || !result) return
        if (result.ok) {
          log({ kind: 'claimed', text: 'Claimed your NFT', txHash: result.transactionHash })
          void granted.refetch()
        } else if (result.kind === 'expired') {
          log({ kind: 'expired', text: 'Permission expired, agent stopped' })
          setOn(false)
          return
        } else {
          log({ kind: 'error', text: result.message })
        }
      } catch (e) {
        log({ kind: 'error', text: (e as Error).message })
      } finally {
        if (!cancelled) setRunning(false)
      }
      if (cancelled) return
      if (latest.current.claims + 1 >= MAX_CLAIMS) {
        log({ kind: 'stopped', text: `Paused after ${MAX_CLAIMS} claims` })
        setOn(false)
        return
      }
      setNextAt(Date.now() + TICK_MS)
      timer = setTimeout(run, TICK_MS)
    }
    setNextAt(Date.now() + 1000)
    timer = setTimeout(run, 1000)
    return () => {
      cancelled = true
      clearTimeout(timer)
      setNextAt(null)
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: restart only when on/off or the grant changes
  }, [on, agentGrant?.permissionsContext])

  // One object drives both the consent sheet and the grant.
  const turnOn = () => {
    if (!agentAddress || !address) return
    setGrantError(null)
    setPending({
      signer: agentAddress,
      chainId: arbitrumSepolia.id,
      expiry: nowSeconds() + HOUR,
      permissions: [
        {
          type: 'contract-call',
          label: 'Demo NFT',
          target: NFT_ADDRESS,
          abi: NFT_ABI,
          functionName: 'mint',
          args: [{ condition: 'equal', value: address }],
        },
      ],
    })
  }

  const activate = async () => {
    await granted.refetch()
    log({ kind: 'started', text: 'Agent turned on' })
    setOn(true)
  }

  const confirm = async () => {
    const params = pending
    setPending(null)
    if (!params) return
    setGranting(true)
    try {
      await grant.mutateAsync(params)
      await activate()
    } catch (e) {
      setGrantError((e as Error).message)
    } finally {
      setGranting(false)
    }
  }

  // The same grant through viem's standard ERC-7715 action.
  const turnOnViaViem = async () => {
    if (!walletClient || !agentAddress || !address) return
    setGranting(true)
    setGrantError(null)
    try {
      await walletClient.extend(erc7715Actions()).grantPermissions({
        expiry: nowSeconds() + HOUR,
        signer: { type: 'account', data: { id: agentAddress } },
        permissions: [
          {
            type: 'contract-call',
            data: { address: NFT_ADDRESS, calls: [MINT_SIGNATURE] },
            policies: [
              {
                type: { custom: ZERODEV_ARG_RULES },
                data: { call: MINT_SIGNATURE, args: [{ condition: 'equal', value: address }] },
              },
            ],
            required: true,
          },
        ],
      })
      await activate()
    } catch (e) {
      setGrantError((e as Error).message)
    } finally {
      setGranting(false)
    }
  }

  const revokeGrant = async (p: GrantedPermission) => {
    const { transactionHash } = await revoke.mutateAsync({
      permissionsContext: p.permissionsContext,
      chainId: p.chainId,
    })
    if (p.permissionsContext === agentGrant?.permissionsContext) setOn(false)
    log({ kind: 'stopped', text: 'You revoked the permission on-chain', txHash: transactionHash })
  }

  // Turning off revokes on-chain from the user's own wallet, so the agent
  // cannot keep acting even if its server ignored the stop.
  const turnOff = async () => {
    setGrantError(null)
    try {
      if (agentGrant) await revokeGrant(agentGrant)
      else setOn(false)
    } catch (e) {
      setGrantError(`Revoke failed: ${(e as Error).message}`)
    } finally {
      await granted.refetch()
    }
  }

  const revokeOne = async (p: GrantedPermission) => {
    if (
      p.status === 'pending' &&
      !window.confirm(
        'This permission was never used, so revoking it invalidates your account nonce. That also turns off every other permission on this account. Continue?',
      )
    ) {
      return
    }
    try {
      await revokeGrant(p)
    } catch (e) {
      setGrantError(`Revoke failed: ${(e as Error).message}`)
    } finally {
      await granted.refetch()
    }
  }

  const simulateRogue = async () => {
    setRogueBusy(true)
    try {
      const result = await tick('rogue')
      if (!result) return
      if (result.ok) {
        log({ kind: 'error', text: 'Rogue mint went through', txHash: result.transactionHash })
      } else if (result.kind === 'denied') {
        log({ kind: 'blocked', text: `Blocked a mint to someone else (${result.reason})` })
      } else {
        log({ kind: 'error', text: result.message })
      }
    } finally {
      setRogueBusy(false)
    }
  }

  const agentOn = on && Boolean(agentGrant)

  return (
    <>
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
          <SignatureRequest
            request={{ method: 'wallet_grantPermissions', params: [toErc7715Request(pending)] }}
            onConfirm={confirm}
            onReject={() => setPending(null)}
          />
        </div>
      )}

      <div className="min-h-screen">
        <AppHeader />
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <Link
                href="/dashboard"
                className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to wallet
              </Link>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent-warm)]">
                Daily drops
              </p>
              <h1 className="mt-2 font-[var(--font-dm-sans)] text-3xl font-bold leading-tight text-[var(--ink)] sm:text-4xl">
                Never miss a claim
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">
                Turn on auto-claim and our agent claims every drop for you. It can only send
                drops to you, and you can revoke it any time.
              </p>
            </div>
            {isConnected && (
              <div className="flex items-center gap-2 self-start rounded-full border border-[var(--border-warm)] bg-white px-3 py-1.5 text-xs text-[var(--muted)] sm:self-auto">
                <Wallet className="h-3.5 w-3.5 text-[var(--ink)]" />
                <span className="font-mono">{address ? short(address) : ''}</span>
              </div>
            )}
          </div>

          {!isConnected ? (
            <SignInCard />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <div className="flex flex-col gap-4">
                <AutoClaimCard
                  on={agentOn}
                  running={running}
                  nextAt={nextAt}
                  claims={claims}
                  granting={granting}
                  revoking={revoke.isPending}
                  error={grantError}
                  ready={Boolean(agentAddress)}
                  onTurnOn={turnOn}
                  onTurnOnViaViem={walletClient ? turnOnViaViem : undefined}
                  onTurnOff={turnOff}
                />
                {agentGrant && (
                  <LimitsCard
                    expiresIn={expiresIn ?? 0}
                    agent={agentAddress}
                    busy={rogueBusy}
                    onSimulateRogue={simulateRogue}
                  />
                )}
                <GrantedCard
                  permissions={granted.data ?? []}
                  loading={granted.isLoading}
                  agent={agentAddress}
                  revoking={revoke.isPending}
                  onRevoke={revokeOne}
                />
              </div>
              <ActivityCard events={events} on={agentOn} />
            </div>
          )}

          <p className="mt-8 text-center text-xs text-[var(--muted)]">
            Staging · Arbitrum Sepolia · the agent signs with a ZeroDev server wallet whose key
            stays in Turnkey · in this demo it runs while this page is open
          </p>
        </main>
      </div>
    </>
  )
}

function SignInCard() {
  return (
    <div className="grid place-items-center rounded-2xl border border-[var(--border-warm)] bg-white p-10 text-center">
      <Wallet className="h-6 w-6 text-[var(--ink)]" />
      <p className="mt-3 font-[var(--font-dm-sans)] text-lg font-bold text-[var(--ink)]">
        Sign in to set up auto-claim
      </p>
      <p className="mb-5 mt-1 text-sm text-[var(--muted)]">Drops go to the wallet you sign in with.</p>
      <ConnectWallet
        size="md"
        logo={<ZeroDevLogo variant="mark" tone="color" className="zd:h-8 zd:w-auto" />}
      />
    </div>
  )
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-[var(--border-warm)] bg-white p-5', className)}>
      {children}
    </section>
  )
}

function AutoClaimCard(props: {
  on: boolean
  running: boolean
  nextAt: number | null
  claims: number
  granting: boolean
  revoking: boolean
  error: string | null
  ready: boolean
  onTurnOn: () => void
  onTurnOnViaViem?: (() => void) | undefined
  onTurnOff: () => void
}) {
  const secondsToNext = props.nextAt ? Math.max(0, Math.round((props.nextAt - Date.now()) / 1000)) : null
  const state = props.on
    ? props.running
      ? 'Claiming now…'
      : secondsToNext !== null
        ? `Next claim in ${secondsToNext}s`
        : 'On'
    : 'Off'

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'grid h-10 w-10 place-items-center rounded-full border',
              props.on
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-[var(--border-warm)] bg-[var(--surface-warm)] text-[var(--ink)]',
            )}
          >
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-[var(--font-dm-sans)] text-lg font-bold text-[var(--ink)]">Auto-claim</h2>
            <p className="flex items-center gap-1.5 text-sm text-[var(--muted)]">
              {props.on && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              )}
              {state}
            </p>
          </div>
        </div>
        {props.on && (
          <span className="rounded-full bg-[var(--surface-warm)] px-2.5 py-1 text-xs font-semibold tabular-nums text-[var(--ink)]">
            {props.claims} claimed
          </span>
        )}
      </div>

      <div className="mt-5">
        {props.on ? (
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={props.onTurnOff}
              disabled={props.revoking}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[var(--border-warm)] bg-white text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-warm)] disabled:opacity-50"
            >
              {props.revoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
              {props.revoking ? 'Revoking on-chain…' : 'Turn off and revoke'}
            </button>
            <p className="text-center text-xs text-[var(--muted)]">
              Removes the agent&apos;s permission from your wallet on-chain.
            </p>
            {props.error && <p className="text-center text-xs text-red-700">{props.error}</p>}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={props.onTurnOn}
              disabled={!props.ready || props.granting}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {props.granting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {props.granting ? 'Setting up…' : 'Turn on auto-claim'}
            </button>
            {props.onTurnOnViaViem && (
              <button
                type="button"
                onClick={props.onTurnOnViaViem}
                disabled={!props.ready || props.granting}
                className="text-xs text-[var(--muted)] underline-offset-2 hover:text-[var(--ink)] hover:underline disabled:opacity-50"
              >
                Developer: grant with viem&apos;s ERC-7715 action
              </button>
            )}
            {props.error && <p className="text-center text-xs text-red-700">{props.error}</p>}
          </div>
        )}
      </div>
    </Card>
  )
}

function LimitsCard(props: {
  expiresIn: number
  agent: Address | null
  busy: boolean
  onSimulateRogue: () => void
}) {
  const mins = Math.max(1, Math.round(props.expiresIn / 60))
  return (
    <Card>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-emerald-700" />
        <h3 className="font-[var(--font-dm-sans)] text-sm font-bold text-[var(--ink)]">What the agent can do</h3>
      </div>
      <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-[var(--muted)]">Can</dt>
        <dd className="text-[var(--ink)]">Mint Demo NFT, only to you</dd>
        <dt className="text-[var(--muted)]">Expires</dt>
        <dd className="flex items-center gap-1.5 text-[var(--ink)]">
          <Clock className="h-3.5 w-3.5 text-[var(--muted)]" />
          in {mins} min
        </dd>
        <dt className="text-[var(--muted)]">Agent</dt>
        <dd className="font-mono text-xs text-[var(--ink)]">{props.agent ? short(props.agent) : '…'}</dd>
      </dl>
      <div className="mt-4 border-t border-[var(--border-warm)] pt-3">
        <button
          type="button"
          onClick={props.onSimulateRogue}
          disabled={props.busy}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-50"
        >
          {props.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />}
          Simulate a compromised agent
        </button>
        <p className="mt-1 text-xs text-[var(--muted)]">
          It tries to mint to someone else. The chain should refuse it.
        </p>
      </div>
    </Card>
  )
}

function GrantedCard(props: {
  permissions: GrantedPermission[]
  loading: boolean
  agent: Address | null
  revoking: boolean
  onRevoke: (p: GrantedPermission) => void
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="font-[var(--font-dm-sans)] text-sm font-bold text-[var(--ink)]">
          Permissions you&apos;ve granted
        </h3>
        <span className="text-xs text-[var(--muted)]">this device</span>
      </div>
      {props.loading ? (
        <p className="mt-3 text-sm text-[var(--muted)]">Checking on-chain…</p>
      ) : props.permissions.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">None. Nothing can act for you.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--border-warm)]">
          {props.permissions.map((p) => {
            const call = p.permissions.find((x) => x.type === 'contract-call')
            const what =
              p.permissions.some((x) => x.type === 'sudo')
                ? 'Anything'
                : call && call.type === 'contract-call'
                  ? `${call.functionName} on ${call.label ?? short(call.target)}`
                  : 'Contract calls'
            const mins = Math.max(0, Math.round((p.expiry - nowSeconds()) / 60))
            const isAgent = props.agent && p.signer.toLowerCase() === props.agent.toLowerCase()
            return (
              <li key={p.permissionsContext} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[var(--ink)]">{what}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {isAgent ? 'Auto-claim agent' : short(p.signer)} · {mins} min left
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    p.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-[var(--surface-warm)] text-[var(--muted)]',
                  )}
                  title={p.status === 'active' ? 'Installed on your account' : 'Granted, not used yet'}
                >
                  {p.status === 'active' ? 'In use' : 'Not used yet'}
                </span>
                <button
                  type="button"
                  onClick={() => props.onRevoke(p)}
                  disabled={props.revoking}
                  className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50"
                >
                  Revoke
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

const EVENT_STYLE: Record<ActivityEvent['kind'], { icon: ReactNode; tone: string }> = {
  claimed: { icon: <Check className="h-3.5 w-3.5" />, tone: 'bg-emerald-50 text-emerald-700' },
  blocked: { icon: <ShieldCheck className="h-3.5 w-3.5" />, tone: 'bg-sky-50 text-sky-700' },
  expired: { icon: <Clock className="h-3.5 w-3.5" />, tone: 'bg-amber-50 text-amber-800' },
  error: { icon: <TriangleAlert className="h-3.5 w-3.5" />, tone: 'bg-red-50 text-red-700' },
  started: { icon: <KeyRound className="h-3.5 w-3.5" />, tone: 'bg-[var(--surface-warm)] text-[var(--ink)]' },
  stopped: { icon: <Power className="h-3.5 w-3.5" />, tone: 'bg-[var(--surface-warm)] text-[var(--muted)]' },
}

function ActivityCard({ events, on }: { events: ActivityEvent[]; on: boolean }) {
  return (
    <Card className="min-h-[320px]">
      <div className="flex items-center justify-between">
        <h2 className="font-[var(--font-dm-sans)] text-lg font-bold text-[var(--ink)]">Agent activity</h2>
        {on && <span className="text-xs text-[var(--muted)]">Live</span>}
      </div>
      {events.length === 0 ? (
        <div className="grid h-[240px] place-items-center text-center">
          <div>
            <Bot className="mx-auto h-6 w-6 text-[var(--muted)]" />
            <p className="mt-2 text-sm text-[var(--muted)]">
              Turn on auto-claim and the agent&apos;s claims show up here.
            </p>
          </div>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--border-warm)]">
          {events.map((e) => (
            <li key={`${e.at}-${e.kind}`} className="flex items-center gap-3 py-3">
              <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full', EVENT_STYLE[e.kind].tone)}>
                {EVENT_STYLE[e.kind].icon}
              </span>
              <p className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">{e.text}</p>
              {e.txHash && (
                <a
                  href={EXPLORER + e.txHash}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--ink)] underline-offset-2 hover:underline"
                >
                  Tx <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <span className="w-16 shrink-0 text-right text-xs tabular-nums text-[var(--muted)]">{ago(e.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
