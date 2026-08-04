import type { MockRequest } from '../types.js'

/**
 * Replaces the wallet address the app reports.
 *
 * `GET {projectId}/user-wallet` returns its body straight through
 * (`packages/core/src/actions/wallet/getUserWallet.ts`), and the viem adapter
 * takes the address from it verbatim — `address = walletResponse.walletAddresses[0]`
 * (`packages/core/src/adapters/viem.ts:46`). So this is the shortest path from a
 * mocked response to something visible.
 *
 * A plain REST GET, which is the point: no Multicall3 in the way, unlike anything
 * wagmi reads, so matching on method and path is enough.
 *
 * The address is fabricated so the assertion cannot pass by accident — a real
 * login can't produce it.
 */

export const MOCK_WALLET_ADDRESS = '0xdeadbeef00000000000000000000000000001234'

export const userWallet: MockRequest[] = [
  {
    // Any host and project id: the KMS base URL moves with `?kms=`.
    url: /\/user-wallet$/,
    method: 'GET',
    response: {
      walletAddresses: [MOCK_WALLET_ADDRESS],
      userId: 'mocked-user-id',
    },
  },
]
