// Server entry for Kernel smart accounts: act on a user's account with a
// permission they granted to a server wallet. Requires the optional peers
// `@zerodev/sdk` and `@zerodev/permissions`; `@zerodev/wallet-core/server`
// stays free of them.
export {
  type CreateSessionClientParameters,
  createSessionClient,
  getZeroDevAAUrl,
  type SessionClient,
  toSessionSigner,
} from './createSessionClient.js'
export {
  PermissionDeniedError,
  type PermissionDeniedReason,
  PermissionExpiredError,
  parsePermissionError,
} from './errors.js'
