/**
 * Injects EIP-6963 announcements so the lab's wallet-discovery UI can be driven
 * without a browser extension.
 *
 * **Discovery only, not wallet functionality.** The provider answers the few
 * EIP-1193 calls reachable while nothing is connected and refuses the rest. It
 * must not grow into a wallet: a fake that answers `personal_sign` invites
 * assertions on the fake instead of on our code.
 *
 * Covers: an announcement reaching wagmi as a connector, the INSTALLED badge,
 * `InstalledWallets` de-duping a pinned row, and direct-connect being chosen
 * over a WalletConnect handoff.
 *
 * Does **not** cover, so do not read a green run as covering it: real EIP-1193
 * error codes in practice (4001 vs 4902), real signature bytes, or how an actual
 * wallet behaves. Those need a real extension.
 *
 * The mock announces a wallet that does not exist rather than impersonating one.
 * A mock claiming `io.metamask` would collide with the real extension suite, and
 * a failure would not say which layer broke. It also puts the mock on the
 * no-guide-entry branch of `SignUpInstalledWallets`, which nothing else covers.
 *
 * Not named `zerodev-*`: that is the id of the embedded wallet's own connector,
 * which `announcesWallet` excludes — the one wallet this does not mock.
 */

import type { Page } from '@playwright/test'

/**
 * An EIP-6963 identity. `rdns` is the mechanism: wagmi makes a connector whose
 * `id` **is** the rdns, and `announcesWallet` matches on exactly that.
 */
export type MockWallet = {
  rdns: string
  name: string
  /** Optional `data:` URI. Only rendered for wallets with no guide entry. */
  icon?: string
}

/** The default mock. The rdns sits outside `WALLET_GUIDE` on purpose. */
export const MOCK_WALLET: MockWallet = {
  rdns: 'dev.qalab.mock-wallet',
  name: 'QA Mock Wallet',
}

/**
 * A second identity, for ordering, the `maxWallets` cap, or proving two wallets
 * do not collapse into one row. Deliberately **not a prefix of**
 * `MOCK_WALLET` — substring locators would otherwise resolve both rows.
 */
export const MOCK_WALLET_TWO: MockWallet = {
  rdns: 'dev.qalab.spare-wallet',
  name: 'QA Spare Wallet',
}

export interface AnnounceOptions {
  /** What `eth_chainId` reports. Defaults to Sepolia. */
  chainIdHex?: string
}

/**
 * Announces `wallets` over EIP-6963 for the life of the page.
 *
 * **Must be called before `page.goto`** — it installs an init script, and the
 * dapp dispatches `eip6963:requestProvider` during its first render.
 */
export async function announceMockWallets(
  page: Page,
  wallets: MockWallet[],
  options: AnnounceOptions = {},
): Promise<void> {
  const chainIdHex = options.chainIdHex ?? '0xaa36a7' // Sepolia, 11155111

  await page.addInitScript(
    ([list, chainId]) => {
      for (const wallet of list) {
        const provider = {
          request: async ({ method }: { method: string }) => {
            switch (method) {
              // Nothing is connected; this keeps the login screen up, which
              // is where discovery is visible.
              case 'eth_accounts':
                return []
              case 'eth_chainId':
                return chainId
              // The user-declines path, chosen over a fabricated address so
              // no test can pass on a connection that never happened. viem maps
              // 4001 to UserRejectedRequestError, which the SDK treats as a
              // cancellation rather than an error takeover.
              case 'eth_requestAccounts':
                throw Object.assign(new Error('User rejected the request.'), {
                  code: 4001,
                })
              // EIP-1193 "unsupported method". Refusing beats inventing a
              // plausible answer for something this does not model.
              default:
                throw Object.assign(
                  new Error(`Mock wallet does not implement ${method}`),
                  { code: 4200 },
                )
            }
          },
          // wagmi subscribes on connector setup and throws without these.
          on: () => {},
          removeListener: () => {},
        }

        const detail = Object.freeze({
          info: Object.freeze({
            uuid: crypto.randomUUID(),
            name: wallet.name,
            icon:
              wallet.icon ??
              'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E',
            rdns: wallet.rdns,
          }),
          provider,
        })

        const announce = () =>
          window.dispatchEvent(
            new CustomEvent('eip6963:announceProvider', { detail }),
          )

        // Both halves of the handshake: answering the request alone loses the
        // race if the dapp asks first, announcing alone is missed if it asks
        // later.
        window.addEventListener('eip6963:requestProvider', announce)
        announce()
      }
    },
    [wallets, chainIdHex] as const,
  )
}
