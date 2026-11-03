'use client'

import { useEffect, useRef, useState } from 'react'

type Entry = {
  seq: number
  at: string
  changes: [string, string, string][]
  /** The two sources disagreed at this point. */
  conflict?: string
}

const LIMIT = 60

/**
 * Appends an entry whenever any watched value changes. Runs on every render
 * and returns early when nothing moved, which is cheap and avoids a
 * dependency array over an object rebuilt each render.
 *
 * `conflict` is the reason this exists: wagmi and the kit can report
 * different things about the same EVM connection, and a log is the only way
 * to see the window where they do.
 */
export function useChangeLog(
  values: Record<string, string>,
  conflict?: string,
): Entry[] {
  const [log, setLog] = useState<Entry[]>([])
  const prev = useRef<Record<string, string> | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    const before = prev.current
    const changes = Object.entries(values)
      .filter(([k, v]) => before?.[k] !== v)
      .map(([k, v]): [string, string, string] => [k, before?.[k] ?? '—', v])
    if (before !== null && changes.length === 0) return
    prev.current = { ...values }
    seq.current += 1
    const entry: Entry = {
      seq: seq.current,
      at: new Date().toISOString().slice(11, 23),
      changes: before === null ? [] : changes,
      ...(conflict && { conflict }),
    }
    setLog((l) => [entry, ...l].slice(0, LIMIT))
  })

  return log
}

export function EventLog({ log }: { log: Entry[] }) {
  return (
    <section className="mt-6 rounded-2xl border border-border-warm bg-white p-6">
      <h2 className="text-lg font-semibold">Event log</h2>
      <p className="mt-1 text-sm text-muted">
        One entry per change, newest first. A red line means wagmi and the kit
        disagree about the same connection.
      </p>

      {log.length === 0 ? (
        <p className="mt-4 font-mono text-xs text-muted">(nothing yet)</p>
      ) : (
        // Capped and scrolled, so the log's length never moves anything
        // else on the page however long a session runs.
        <ol className="mt-4 max-h-80 space-y-2 overflow-y-auto font-mono text-xs">
          {log.map((entry) => (
            <li
              key={entry.seq}
              className="border-border-warm border-t pt-2 first:border-t-0 first:pt-0"
            >
              <span className="text-muted">
                {entry.at} · #{entry.seq}
              </span>
              {entry.changes.length === 0 ? (
                <span className="ml-2">initial render</span>
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {entry.changes.map(([key, from, to]) => (
                    <li key={key} className="break-all">
                      <span className="text-muted">{key}</span> {from} →{' '}
                      <span className="font-semibold">{to}</span>
                    </li>
                  ))}
                </ul>
              )}
              {entry.conflict && (
                <p className="mt-1 text-danger">{entry.conflict}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
