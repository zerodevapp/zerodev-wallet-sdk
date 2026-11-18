/**
 * Registers Wallet Standard wallets so the lab's Solana discovery and restore
 * can be driven without an extension.
 *
 * **The signatures are fabricated.** Signing features are declared only so the
 * handle's capability plumbing can be driven; the bytes they return are made up
 * here and prove nothing about any wallet. Anything asserting that a wallet
 * signed what was sent needs a real extension.
 */

import type { Page } from '@playwright/test'

/** The `solana:*` signing features a mock can declare. */
export type MockSolanaFeature =
  | 'solana:signMessage'
  | 'solana:signTransaction'
  | 'solana:signAndSendTransaction'

export type MockSolanaWallet = {
  name: string
  /** Base58, 32-44 characters, so it satisfies the lab's address assertion. */
  address: string
  /** What the wallet implements. Omitted means none, the discovery-only shape. */
  features?: MockSolanaFeature[]
  /**
   * What the connected account declares, when it is not what the wallet
   * implements
   */
  accountFeatures?: MockSolanaFeature[]
}

/**
 * The default mock. Named so it matches no entry in `WALLET_GUIDE` — a
 * Solana-native wallet is exactly the case TC-26 is about, and borrowing a
 * guide name would change its rank and hide the behaviour.
 */
export const MOCK_SOLANA_WALLET: MockSolanaWallet = {
  name: 'QA Solana Mock',
  address: 'QAmockSoLanaWa11etAddress1111111111111111',
}

/**
 * Set in the page's own storage to withhold registration on the next load,
 * which is how a disabled extension looks to the registry.
 */
const DISABLED_KEY = 'qa-solana-mock-disabled'

/**
 * Registers `wallets` on the Wallet Standard registry for the life of the page.
 *
 * **Must be called before `page.goto`** — it installs an init script, and the
 * app reads the registry during its first render.
 * @param page The Playwright page on which to register the mock wallets.
 * @param wallets The list of mock Solana wallets to register.
 */
export async function registerMockSolanaWallets(
  page: Page,
  wallets: MockSolanaWallet[],
): Promise<void> {
  await page.addInitScript(
    ([list, disabledKey]) => {
      try {
        if (window.localStorage.getItem(disabledKey) === '1') return
      } catch {
        // Storage unavailable: register, which is the normal case.
      }

      /** The registry handshake, as `@wallet-standard/wallet` performs it. */
      const register = (wallet: unknown) => {
        const callback = ({
          register: add,
        }: {
          register: (w: unknown) => void
        }) => add(wallet)
        // Both halves: the event catches an app that is already listening, the
        // listener catches one that starts listening after this runs.
        window.dispatchEvent(
          new CustomEvent('wallet-standard:register-wallet', {
            detail: callback,
          }),
        )
        window.addEventListener('wallet-standard:app-ready', (event) =>
          callback((event as CustomEvent).detail),
        )
      }

      for (const mock of list) {
        const grantKey = `qa-solana-mock-granted:${mock.name}`
        const granted = () => {
          try {
            return window.localStorage.getItem(grantKey) === '1'
          } catch {
            return false
          }
        }
        const setGranted = (value: boolean) => {
          try {
            if (value) window.localStorage.setItem(grantKey, '1')
            else window.localStorage.removeItem(grantKey)
          } catch {
            // Without storage the session simply will not restore.
          }
        }

        const implemented = mock.features ?? []
        const declared = mock.accountFeatures ?? implemented

        const account = {
          address: mock.address,
          // Deterministic 32 bytes. Nothing derives the address from this —
          // the kit takes the address the wallet reports, verbatim.
          publicKey: Uint8Array.from(
            { length: 32 },
            (_, i) =>
              (mock.address.charCodeAt(i % mock.address.length) + i) % 256,
          ),
          chains: ['solana:mainnet'],
          features: declared,
          label: mock.name,
          icon: undefined,
        }

        /** Fabricated, and deterministic so a run can be compared with itself. */
        const fakeSignature = Uint8Array.from(
          { length: 64 },
          (_, i) =>
            (mock.address.charCodeAt(i % mock.address.length) * 7 + i) % 256,
        )

        const signing: Record<string, unknown> = {}
        if (implemented.includes('solana:signMessage')) {
          signing['solana:signMessage'] = {
            version: '1.0.0',
            signMessage: async ({ message }: { message: Uint8Array }) => [
              // Echoes the bytes it was given, so this mock never looks like a
              // wallet that prefixes the message.
              { signature: fakeSignature, signedMessage: message },
            ],
          }
        }
        if (implemented.includes('solana:signTransaction')) {
          signing['solana:signTransaction'] = {
            version: '1.0.0',
            signTransaction: async ({
              transaction,
            }: {
              transaction: Uint8Array
            }) => [{ signedTransaction: transaction }],
          }
        }
        if (implemented.includes('solana:signAndSendTransaction')) {
          signing['solana:signAndSendTransaction'] = {
            version: '1.0.0',
            signAndSendTransaction: async () => [{ signature: fakeSignature }],
          }
        }

        register({
          version: '1.0.0',
          name: mock.name,
          icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=',
          chains: ['solana:mainnet'],
          get accounts() {
            return granted() ? [account] : []
          },
          features: {
            'standard:connect': {
              version: '1.0.0',
              connect: async (input?: { silent?: boolean }) => {
                // `silent` is the restore path: answer only with what this
                // origin was already granted, never by prompting.
                if (input?.silent && !granted()) return { accounts: [] }
                setGranted(true)
                return { accounts: [account] }
              },
            },
            'standard:disconnect': {
              version: '1.0.0',
              disconnect: async () => setGranted(false),
            },
            'standard:events': {
              version: '1.0.0',
              on: () => () => {},
            },
            ...signing,
          },
        })
      }
    },
    [wallets, DISABLED_KEY] as const,
  )
}

/**
 * Withholds every mock from the next load, the way disabling an extension
 * does. The grant stays in storage, so what the next load exercises is a
 * saved session whose wallet never announces.
 * @param page The Playwright page on which to disable the mock Solana wallets.
 */
export async function disableMockSolanaWallets(page: Page): Promise<void> {
  await page.evaluate((key) => {
    window.localStorage.setItem(key, '1')
  }, DISABLED_KEY)
}
