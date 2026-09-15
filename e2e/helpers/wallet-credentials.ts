/**
 * The test wallet the browser e2e suite imports into a wallet extension.
 *
 * **Public on purpose. Never send this account real funds.**
 *
 * One phrase across every wallet. If one ever needs its own, add an override
 * here rather than splitting the pair.
 */

export interface WalletCredentials {
  /** 12-word BIP-39 phrase. Unfunded, disposable, deliberately public. */
  secretRecoveryPhrase: string
  /** Local to the cached extension profile. Protects nothing. */
  password: string
}

export const TEST_WALLET: WalletCredentials = {
  /** This secret recovery phrase is public and for testing purposes only. Do not use it for real funds. */
  secretRecoveryPhrase:
    'cover unfair advice banana magnet shock language canoe donor moment provide general',
  password: 'Testing_1234',
}
