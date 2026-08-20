'use client'

import type { EmailAuthMethod, WalletId } from '@zerodev/wallet-react-ui'
import {
  Check,
  ChevronDown,
  ChevronUp,
  Chrome,
  Code,
  Copy,
  ExternalLink,
  Fingerprint,
  GripVertical,
  LayoutList,
  type LucideIcon,
  Mail,
  Minus,
  Plus,
  QrCode,
  ScanSearch,
  SlidersHorizontal,
  Wallet,
  WalletCards,
  X,
} from 'lucide-react'
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  buildSnippet,
  PINNED_WALLETS,
  type PlaygroundItem,
  type PlaygroundSettings,
  type SnippetToken,
  tokenizeSnippet,
  UNIT_DEFS,
  unitLabel,
  type UnitType,
} from './utils/snippet'

const TOKEN_CLASS: Record<Exclude<SnippetToken['kind'], 'plain'>, string> = {
  comment: 'italic text-white/55',
  string: 'text-[#a9c77d]',
  tag: 'text-[#ff9e64]',
  keyword: 'text-[#c8a4ff]',
  attr: 'text-[#e8c07f]',
}

const UNIT_ICON: Record<UnitType, LucideIcon> = {
  passkey: Fingerprint,
  google: Chrome,
  email: Mail,
  wallet: Wallet,
  walletConnect: QrCode,
  installedWallets: ScanSearch,
  moreWallets: WalletCards,
  divider: Minus,
}

export function Playground({
  items,
  onChange,
  settings,
  onSettingsChange,
}: {
  items: PlaygroundItem[]
  onChange: Dispatch<SetStateAction<PlaygroundItem[]>>
  settings: PlaygroundSettings
  onSettingsChange: Dispatch<SetStateAction<PlaygroundSettings>>
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'playground' | 'code'>('playground')
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const rowRefs = useRef(new Map<string, HTMLLIElement>())
  const keyCounter = useRef(0)
  const sheetRef = useRef<HTMLElement>(null)
  const pullTabRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (sheetRef.current?.contains(target)) return
      if (pullTabRef.current?.contains(target)) return
      setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  const walletCount = items.filter((i) => i.type === 'wallet').length

  const handleChipClick = (type: UnitType, multi: boolean) => {
    if (!multi && items.some((i) => i.type === type)) {
      onChange((prev) => prev.filter((i) => i.type !== type))
      return
    }
    const key = `pg-${++keyCounter.current}`
    onChange((prev) => {
      if (type === 'email') {
        return [...prev, { key, type: 'email', method: 'otp' }]
      }
      if (type === 'wallet') {
        const used = new Set(
          prev.flatMap((i) => (i.type === 'wallet' ? [i.walletId] : [])),
        )
        const free = PINNED_WALLETS.find((w) => !used.has(w.id))
        if (!free) return prev
        return [...prev, { key, type: 'wallet', walletId: free.id }]
      }
      if (type === 'installedWallets') {
        return [
          ...prev,
          { key, type: 'installedWallets', exclude: '', maxWallets: null },
        ]
      }
      return [...prev, { key, type }]
    })
  }

  const setWalletId = (key: string, walletId: WalletId) => {
    onChange((prev) =>
      prev.map((i) => (i.key === key ? { ...i, walletId } : i)),
    )
  }

  const patchInstalled = (
    key: string,
    patch: Partial<{ exclude: string; maxWallets: number | null }>,
  ) => {
    onChange((prev) =>
      prev.map((i) =>
        i.key === key && i.type === 'installedWallets' ? { ...i, ...patch } : i,
      ),
    )
  }

  const setEmailMethod = (key: string, method: EmailAuthMethod) => {
    onChange((prev) =>
      prev.map((i) =>
        i.key === key && i.type === 'email' ? { ...i, method } : i,
      ),
    )
  }

  const remove = (key: string) => {
    onChange((prev) => prev.filter((i) => i.key !== key))
  }

  const move = (key: string, dir: -1 | 1) => {
    onChange((prev) => {
      const from = prev.findIndex((i) => i.key === key)
      const to = from + dir
      if (from === -1 || to < 0 || to >= prev.length) return prev
      const next = [...prev]
      ;[next[from], next[to]] = [next[to], next[from]]
      return next
    })
  }

  const startDrag = (e: React.PointerEvent, key: string) => {
    e.preventDefault()
    setDraggingKey(key)
    const onMove = (ev: PointerEvent) => {
      onChange((prev) => {
        const from = prev.findIndex((i) => i.key === key)
        if (from === -1) return prev
        // Target slot = how many other rows the pointer sits below (midpoint).
        let to = 0
        for (const item of prev) {
          if (item.key === key) continue
          const el = rowRefs.current.get(item.key)
          if (!el) continue
          const rect = el.getBoundingClientRect()
          if (ev.clientY > rect.top + rect.height / 2) to++
        }
        if (to === from) return prev
        const dragged = prev[from]
        const next = prev.filter((i) => i.key !== key)
        next.splice(to, 0, dragged)
        return next
      })
    }
    const stop = () => {
      setDraggingKey(null)
      window.removeEventListener('pointermove', onMove)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', stop, { once: true })
  }

  const snippet = buildSnippet(items, settings)

  const copySnippet = async () => {
    await navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  let tokenOffset = 0

  return (
    <>
      <button
        ref={pullTabRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open sign-up playground"
        className="fixed left-0 top-1/2 z-30 -translate-y-1/2 cursor-pointer rounded-r-xl border border-l-0 border-[var(--accent-warm)]/40 bg-white/90 px-2 py-4 text-[#9a3412] shadow-lg backdrop-blur transition-colors hover:bg-[var(--accent-warm)]/5"
      >
        <SlidersHorizontal className="mx-auto h-4 w-4" />
        <span className="mt-2 block text-[11px] font-semibold uppercase tracking-[0.15em] [writing-mode:vertical-rl]">
          Playground
        </span>
      </button>

      <aside
        ref={sheetRef}
        role="dialog"
        aria-label="Sign-up playground"
        className={`fixed inset-y-3 left-3 z-50 flex w-[min(520px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-[var(--border-warm)] bg-white shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          open ? 'translate-x-0' : '-translate-x-[calc(100%+40px)]'
        }`}
      >
        <header className="border-b border-[var(--border-warm)] px-6 pb-5 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-warm)]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#9a3412]">
                <SlidersHorizontal className="h-3 w-3" />
                Playground
              </span>
              <h2 className="mt-2.5 font-[var(--font-dm-sans)] text-[22px] font-bold leading-tight text-[var(--ink)]">
                Compose the sign-up flow
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close playground"
              className="cursor-pointer rounded-md border border-transparent p-2 text-[var(--muted)] transition-colors hover:border-[var(--border-warm)] hover:bg-white hover:text-[var(--ink)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">
            Changes apply to the live wallet preview instantly. See the{' '}
            <a
              href="https://docs.zerodev.app/wallets/auth/wallet-ui-kit/installation"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-[#c2410c] underline underline-offset-2 hover:text-[#9a3412]"
            >
              installation guide
              <ExternalLink className="h-3 w-3" />
            </a>{' '}
            to get set up.
          </p>
          <div className="mt-4 flex gap-1 rounded-xl border border-[var(--border-warm)] bg-white/70 p-1">
            <button
              type="button"
              onClick={() => setTab('playground')}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                tab === 'playground'
                  ? 'bg-[var(--accent-warm)]/5 text-[#c2410c]'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Playground
            </button>
            <button
              type="button"
              onClick={() => setTab('code')}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                tab === 'code'
                  ? 'bg-[var(--accent-warm)]/5 text-[#c2410c]'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <Code className="h-3.5 w-3.5" />
              Code
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'playground' ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Add units
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {UNIT_DEFS.map((def) => {
                  const used = items.some((i) => i.type === def.type)
                  const active = !def.multi && used
                  const disabled =
                    def.type === 'wallet' &&
                    walletCount >= PINNED_WALLETS.length
                  const UnitIcon = UNIT_ICON[def.type]
                  return (
                    <button
                      key={def.type}
                      type="button"
                      disabled={disabled}
                      aria-pressed={active}
                      onClick={() => handleChipClick(def.type, def.multi)}
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-default disabled:opacity-40 ${
                        active
                          ? 'border-[var(--accent-warm)]/40 bg-[var(--accent-warm)]/5 text-[#c2410c]'
                          : 'border-[var(--border-warm)] bg-white text-[var(--ink)] hover:border-[var(--accent-warm)]/60 hover:text-[#c2410c]'
                      }`}
                    >
                      <UnitIcon className="h-3.5 w-3.5" />
                      {def.label}
                      {active ? (
                        <Check className="h-3 w-3 opacity-60" />
                      ) : (
                        <Plus className="h-3 w-3 opacity-60" />
                      )}
                    </button>
                  )
                })}
              </div>

              <p className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Composition — drag to reorder
              </p>
              <div className="mt-2.5 rounded-xl border border-[var(--border-warm)] bg-[var(--surface-warm)]/50 p-2">
                {items.length === 0 ? (
                  <div className="px-3 py-8 text-center">
                    <LayoutList className="mx-auto h-5 w-5 text-[#c2410c]/60" />
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      Nothing selected — ConnectWallet falls back to the
                      default sign-up page. Add units above to compose your
                      own.
                    </p>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {items.map((item, idx) => {
                      const dragging = draggingKey === item.key
                      const RowIcon = UNIT_ICON[item.type]
                      const usedWalletIds = new Set(
                        items.flatMap((i) =>
                          i.type === 'wallet' && i.key !== item.key
                            ? [i.walletId]
                            : [],
                        ),
                      )
                      return (
                        <li
                          key={item.key}
                          ref={(el) => {
                            if (el) rowRefs.current.set(item.key, el)
                            else rowRefs.current.delete(item.key)
                          }}
                          className={`rounded-lg px-2 py-1.5 transition-shadow ${
                            dragging
                              ? 'bg-white shadow-md ring-1 ring-[var(--accent-warm)]'
                              : 'hover:bg-white hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              aria-label={`Drag ${unitLabel(item)} to reorder`}
                              onPointerDown={(e) => startDrag(e, item.key)}
                              className={`touch-none select-none p-1 text-[var(--muted)] transition-colors hover:text-[#c2410c] ${
                                dragging ? 'cursor-grabbing' : 'cursor-grab'
                              }`}
                            >
                              <GripVertical className="h-4 w-4" />
                            </button>
                            <span className="w-3 text-center text-[10px] font-medium tabular-nums text-[var(--muted)]">
                              {idx + 1}
                            </span>
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[var(--accent-warm)]/25 bg-[var(--accent-warm)]/10 text-[#c2410c]">
                              <RowIcon className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--ink)]">
                              {item.type === 'wallet'
                                ? 'Pinned wallet'
                                : unitLabel(item)}
                            </span>
                            {item.type === 'wallet' && (
                              <select
                                value={item.walletId}
                                onChange={(e) =>
                                  setWalletId(
                                    item.key,
                                    e.target.value as WalletId,
                                  )
                                }
                                className="cursor-pointer rounded-md border border-[var(--border-warm)] bg-white px-2 py-1 text-xs font-medium text-[var(--ink)]"
                              >
                                {PINNED_WALLETS.map((w) => (
                                  <option
                                    key={w.id}
                                    value={w.id}
                                    disabled={usedWalletIds.has(w.id)}
                                  >
                                    {w.name}
                                  </option>
                                ))}
                              </select>
                            )}
                            {item.type === 'email' && (
                              <span className="flex gap-0.5 rounded-lg border border-[var(--border-warm)] bg-white p-0.5">
                                <button
                                  type="button"
                                  aria-pressed={item.method === 'magicLink'}
                                  onClick={() =>
                                    setEmailMethod(item.key, 'magicLink')
                                  }
                                  className={`cursor-pointer rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                                    item.method === 'magicLink'
                                      ? 'bg-[var(--accent-warm)]/8 text-[#9a3412]'
                                      : 'text-[var(--muted)] hover:text-[#9a3412]'
                                  }`}
                                >
                                  Magic link
                                </button>
                                <button
                                  type="button"
                                  aria-pressed={item.method === 'otp'}
                                  onClick={() =>
                                    setEmailMethod(item.key, 'otp')
                                  }
                                  className={`cursor-pointer rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                                    item.method === 'otp'
                                      ? 'bg-[var(--accent-warm)]/8 text-[#9a3412]'
                                      : 'text-[var(--muted)] hover:text-[#9a3412]'
                                  }`}
                                >
                                  OTP
                                </button>
                              </span>
                            )}
                            <button
                              type="button"
                              aria-label={`Move ${unitLabel(item)} up`}
                              disabled={idx === 0}
                              onClick={() => move(item.key, -1)}
                              className="cursor-pointer rounded-md p-1 text-[var(--muted)] transition-colors hover:text-[#c2410c] disabled:cursor-default disabled:opacity-30"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Move ${unitLabel(item)} down`}
                              disabled={idx === items.length - 1}
                              onClick={() => move(item.key, 1)}
                              className="cursor-pointer rounded-md p-1 text-[var(--muted)] transition-colors hover:text-[#c2410c] disabled:cursor-default disabled:opacity-30"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Remove ${unitLabel(item)}`}
                              onClick={() => remove(item.key)}
                              className="cursor-pointer rounded-md p-1 text-[var(--muted)] hover:text-red-500"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          {item.type === 'installedWallets' && (
                            <div className="mt-1.5 flex items-center gap-2 pl-[52px]">
                              <input
                                type="text"
                                value={item.exclude}
                                onChange={(e) =>
                                  patchInstalled(item.key, {
                                    exclude: e.target.value,
                                  })
                                }
                                placeholder="exclude ids, comma-separated"
                                aria-label="Excluded wallet ids"
                                className="min-w-0 flex-1 rounded-md border border-[var(--border-warm)] bg-white px-2 py-1 font-mono text-xs text-[var(--ink)] outline-none transition-colors placeholder:font-sans placeholder:text-[var(--muted)]/70 focus:border-[var(--accent-warm)] focus:ring-2 focus:ring-[var(--accent-warm)]/20"
                              />
                              <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                                max
                                <input
                                  type="number"
                                  min={1}
                                  value={item.maxWallets ?? ''}
                                  onChange={(e) => {
                                    const n = Number(e.target.value)
                                    patchInstalled(item.key, {
                                      maxWallets:
                                        e.target.value === '' ||
                                        !Number.isFinite(n)
                                          ? null
                                          : Math.max(1, Math.trunc(n)),
                                    })
                                  }}
                                  placeholder="4"
                                  aria-label="Max wallets"
                                  className="w-14 rounded-md border border-[var(--border-warm)] bg-white px-2 py-1 text-xs text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent-warm)] focus:ring-2 focus:ring-[var(--accent-warm)]/20"
                                />
                              </label>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              <p className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Page settings
              </p>
              <div className="mt-2.5 flex flex-col gap-3 rounded-xl border border-[var(--border-warm)] bg-[var(--surface-warm)]/50 p-4">
                <label className="block">
                  <span className="text-xs font-medium text-[var(--ink)]">
                    Terms of service URL
                  </span>
                  <input
                    type="url"
                    value={settings.termsUrl}
                    onChange={(e) =>
                      onSettingsChange((prev) => ({
                        ...prev,
                        termsUrl: e.target.value,
                      }))
                    }
                    placeholder="https://zerodev.app/terms-of-service"
                    className="mt-1 w-full rounded-md border border-[var(--border-warm)] bg-white px-2.5 py-1.5 font-mono text-xs text-[var(--ink)] outline-none transition-colors placeholder:font-sans placeholder:text-[var(--muted)]/70 focus:border-[var(--accent-warm)] focus:ring-2 focus:ring-[var(--accent-warm)]/20"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--ink)]">
                    Privacy policy URL
                  </span>
                  <input
                    type="url"
                    value={settings.privacyUrl}
                    onChange={(e) =>
                      onSettingsChange((prev) => ({
                        ...prev,
                        privacyUrl: e.target.value,
                      }))
                    }
                    placeholder="https://zerodev.app/privacy-policy"
                    className="mt-1 w-full rounded-md border border-[var(--border-warm)] bg-white px-2.5 py-1.5 font-mono text-xs text-[var(--ink)] outline-none transition-colors placeholder:font-sans placeholder:text-[var(--muted)]/70 focus:border-[var(--accent-warm)] focus:ring-2 focus:ring-[var(--accent-warm)]/20"
                  />
                </label>
                <p className="text-xs leading-5 text-[var(--muted)]">
                  Setting either URL turns on the consent checkbox in the
                  sign-up footer — methods stay blocked until the user agrees.
                </p>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[#31281f] bg-[#211a14] shadow-lg">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                <span className="flex items-center gap-3">
                  <span className="flex gap-1.5" aria-hidden="true">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/70" />
                  </span>
                  <span className="font-mono text-xs text-white/65">
                    ConnectWallet setup
                  </span>
                </span>
                <button
                  type="button"
                  onClick={copySnippet}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="flex-1 overflow-auto px-4 py-4 font-mono text-xs leading-6 text-[#efe7dd]">
                <code>
                  {tokenizeSnippet(snippet).map((token) => {
                    const key = tokenOffset
                    tokenOffset += token.text.length
                    if (token.kind === 'plain') return token.text
                    return (
                      <span key={key} className={TOKEN_CLASS[token.kind]}>
                        {token.text}
                      </span>
                    )
                  })}
                </code>
              </pre>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
