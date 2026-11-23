import type { Config, Connector } from 'wagmi'

/**
 * Opt-in console trace of wagmi's status and of each connector's
 * `getProvider` / `isAuthorized` / `connect`, enabled by `?diag=wagmi`.
 *
 * Built to find the connector that leaves EVM at `connecting`: wagmi's mount
 * `reconnect()` reports `connecting` when nothing is current and waits on every
 * connector without a timeout, so a call that logs `start` and never `end` is
 * the one holding it.
 */
export const WAGMI_DIAG_PARAM = 'diag'
export const WAGMI_DIAG_VALUE = 'wagmi'

const installed = new WeakSet<Config>()
const wrapped = new WeakSet<Connector>()
const TRACED = ['getProvider', 'isAuthorized', 'connect'] as const

export function installWagmiDiagnostics(config: Config): void {
  if (installed.has(config)) return
  installed.add(config)

  const t0 = performance.now()
  const log = (...args: unknown[]) =>
    console.info(`[wagmi-diag +${Math.round(performance.now() - t0)}ms]`, ...args)

  const wrap = (connector: Connector) => {
    if (wrapped.has(connector)) return
    wrapped.add(connector)
    for (const method of TRACED) {
      const original = connector[method] as (...a: unknown[]) => Promise<unknown>
      ;(connector as Record<string, unknown>)[method] = async (...a: unknown[]) => {
        const label = `${connector.id} ${method}`
        log(label, 'start')
        try {
          const result = await original.apply(connector, a)
          log(label, 'end', method === 'getProvider' ? !!result : result)
          return result
        } catch (error) {
          log(label, 'throw', String(error))
          throw error
        }
      }
    }
  }

  log('status', config.state.status)
  config.subscribe(
    (state) => state.status,
    (status, previous) => log('status', previous, '->', status),
  )
  config.connectors.forEach(wrap)
  // EIP-6963 wallets announce after createConfig, so they join later.
  config._internal.connectors.subscribe((connectors) => connectors.forEach(wrap))
}
