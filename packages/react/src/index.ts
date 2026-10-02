import { isReactNative } from './utils/platform.js'

if (isReactNative()) {
  console.warn(
    '@zerodev/wallet-react: the web entry was loaded in a React Native runtime. Check that your metro.config.js has `unstable_enablePackageExports: true` and `"react-native"` in `unstable_conditionNames`.',
  )
}

export {
  getZeroDevConnector,
  getZeroDevStore,
  getZeroDevWallet,
} from './actions.js'
export type { GetOAuthSessionIdFn } from './authenticateOAuth.js'
export { NotAuthenticatedError } from './errors.js'
export { useAuthenticators } from './hooks/useAuthenticators.js'
export { useExportPrivateKey } from './hooks/useExportPrivateKey.js'
export { useExportWallet } from './hooks/useExportWallet.js'
export { useGrantedPermissions } from './hooks/useGrantedPermissions.js'
export { useGrantPermissions } from './hooks/useGrantPermissions.js'
export { useLoginPasskey } from './hooks/useLoginPasskey.js'
export { useRefreshSession } from './hooks/useRefreshSession.js'
export { useRegisterPasskey } from './hooks/useRegisterPasskey.js'
export { useRevokePermissions } from './hooks/useRevokePermissions.js'
export { useSendMagicLink } from './hooks/useSendMagicLink.js'
export { useSendOTP } from './hooks/useSendOTP.js'
export { useVerifyMagicLink } from './hooks/useVerifyMagicLink.js'
export { useVerifyOTP } from './hooks/useVerifyOTP.js'
export {
  type Erc7715GrantPermissionsRequest,
  type Erc7715GrantPermissionsResponse,
  type Erc7715Permission,
  type Erc7715Policy,
  fromErc7715Request,
  toErc7715Request,
  ZERODEV_ARG_RULES,
  ZERODEV_SUDO,
} from './permissions/erc7715.js'
export {
  type GrantedPermission,
  getGrantedPermissions,
} from './permissions/getGrantedPermissions.js'
export { grantPermissions } from './permissions/grantPermissions.js'
export {
  classifyGrant,
  type GrantRecord,
  type GrantStatus,
} from './permissions/grantStatus.js'
export {
  type RevokePermissionsParameters,
  type RevokePermissionsReturnType,
  revokePermissions,
} from './permissions/revokePermissions.js'
export { toPolicies } from './permissions/toPolicies.js'
export type {
  ArgRule,
  ContractCallPermission,
  GrantPermissionsParameters,
  GrantPermissionsReturnType,
  SessionPermission,
  SudoPermission,
} from './permissions/types.js'
export type { ZeroDevProvider } from './provider.js'
export type { ZeroDevWalletState } from './store.js'
export { createZeroDevWalletStore } from './store.js'
export { isClientError, shouldRetryRequest } from './utils/query.js'
export type { OAuthProvider } from './utils/verifyGoogleLoginUrl.js'
export {
  generateOAuthNonce,
  OAUTH_PROVIDERS,
  verifyGoogleLoginUrl,
} from './utils/verifyGoogleLoginUrl.js'
export type {
  WalletMode,
  ZeroDevWalletConnectorParams,
} from './web/connector.js'
export { zeroDevWallet } from './web/connector.js'
export { useAuthenticateOAuth } from './web/useAuthenticateOAuth.js'
