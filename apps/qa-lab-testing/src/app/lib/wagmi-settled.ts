import type { Config } from 'wagmi'

/**
 * Stamps `data-wagmi-settled="true"` on `<html>` once wagmi's mount
 * `reconnect()` has finished, so tests can act on a settled page the way a
 * person would.
 *
 * The reconnect is the first thing to move wagmi's status off `disconnected`,
 * and nothing else can until it ends, so the first move back out of
 * `connecting`/`reconnecting` is its end. Installed during render, before
 * WagmiProvider's mount effect starts the reconnect.
 */
const watched = new WeakSet<Config>()

export function markWagmiSettled(config: Config): void {
  if (watched.has(config)) return
  watched.add(config)

  let started = false
  const unsubscribe = config.subscribe(
    (state) => state.status,
    (status) => {
      if (status === 'connecting' || status === 'reconnecting') {
        started = true
        return
      }
      if (!started) return
      document.documentElement.dataset.wagmiSettled = 'true'
      unsubscribe()
    },
  )
}
