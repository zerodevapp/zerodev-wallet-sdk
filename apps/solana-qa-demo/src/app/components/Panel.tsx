'use client'

import { useState } from 'react'

export type Row = { label: string; value: string }

export type Action = {
  label: string
  /** Shown while running, e.g. "Signing…". */
  busyLabel: string
  run: () => Promise<unknown>
  disabled?: boolean
  /** Why it is disabled. A disabled button with no reason is the one thing a
   * harness must not show. */
  hint?: string
  tone?: 'primary' | 'accent' | 'quiet'
}

const TONE = {
  primary: 'bg-ink text-white',
  accent: 'bg-primary text-white',
  quiet: 'border border-border-warm',
} as const

/**
 * Presentational only. Each route wires its own hooks and passes the actions
 * in, so the difference between reading the kit and reading wagmi stays
 * visible in the page file rather than hiding in here.
 */
export function Panel({
  title,
  note,
  rows,
  actions,
}: {
  title: string
  note: string
  rows: Row[]
  actions: Action[]
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Every outcome is shown, cancellations included: "nothing happened" is the
  // one result a QA harness must never render as success.
  const run = (action: Action) => async () => {
    setBusy(action.label)
    setResult(null)
    setError(null)
    try {
      const value = await action.run()
      setResult(typeof value === 'string' ? value : `${action.label}: ok`)
    } catch (err) {
      const e = err as { name?: string; message?: string }
      setError(`${e.name ?? 'Error'}: ${e.message ?? String(err)}`)
    } finally {
      setBusy(null)
    }
  }

  const hints = actions.filter((a) => a.disabled && a.hint)

  return (
    <section className="rounded-2xl border border-border-warm bg-white p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{note}</p>

      <div className="mt-5 flex flex-wrap gap-3">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={run(action)}
            disabled={busy !== null || action.disabled}
            className={`rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-40 ${
              TONE[action.tone ?? 'quiet']
            }`}
          >
            {busy === action.label ? action.busyLabel : action.label}
          </button>
        ))}
      </div>

      {hints.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-muted">
          {hints.map((a) => (
            <li key={a.label}>
              <span className="font-semibold">{a.label}:</span> {a.hint}
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-6 grid grid-cols-[11rem_1fr] gap-x-4 gap-y-1 font-mono text-xs">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-muted">{row.label}</dt>
            <dd className="break-all">{row.value}</dd>
          </div>
        ))}
      </dl>

      {result && (
        <p className="mt-4 break-all rounded-xl bg-ok/10 p-3 font-mono text-xs text-ok">
          {result}
        </p>
      )}
      {error && (
        <p className="mt-4 break-all rounded-xl bg-danger/10 p-3 font-mono text-xs text-danger">
          {error}
        </p>
      )}
    </section>
  )
}
