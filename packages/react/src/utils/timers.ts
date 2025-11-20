// Timer utilities for session management
// Handles delays >24.8 days (setTimeout limit) by chunking

export type TimerController = { clear: () => void }
export type TimerMap = Record<string, TimerController>

export const MAX_DELAY_MS = 2_147_483_647 // ~24.8 days

function toIntMs(x: number) {
  return Math.max(0, Math.floor(Number.isFinite(x) ? x : 0))
}

/**
 * A drop-in replacement for `setTimeout` that supports arbitrarily long delays.
 * Browsers clamp `setTimeout` delays to ~24.8 days. This helper safely schedules
 * timeouts that can be months or years into the future by chunking.
 */
export function setCappedTimeout(
  cb: () => void,
  delayMs: number,
): TimerController {
  const target = Date.now() + toIntMs(delayMs)
  let handle: ReturnType<typeof setTimeout> | undefined

  const tick = () => {
    const remaining = target - Date.now()
    if (remaining <= 0) {
      cb()
      return
    }
    handle = setTimeout(tick, Math.min(MAX_DELAY_MS, remaining))
  }

  tick()

  return {
    clear() {
      if (handle !== undefined) {
        clearTimeout(handle)
        handle = undefined
      }
    },
  }
}

/** Replace any existing timer for `key` with `controller`. */
export function putTimer(
  map: TimerMap,
  key: string,
  controller: TimerController,
) {
  map[key]?.clear?.()
  map[key] = controller
}

/** Clear a specific key (noop if missing). */
export function clearKey(map: TimerMap, key: string) {
  map[key]?.clear?.()
  delete map[key]
}

/** Clear all timers in the map. */
export function clearAll(map: TimerMap) {
  for (const k of Object.keys(map)) {
    map[k]?.clear?.()
    delete map[k]
  }
}

/**
 * Convenience: set a capped timeout directly into the map for `key`.
 */
export function setCappedTimeoutInMap(
  map: TimerMap,
  key: string,
  cb: () => void,
  delayMs: number,
) {
  putTimer(map, key, setCappedTimeout(cb, delayMs))
}
