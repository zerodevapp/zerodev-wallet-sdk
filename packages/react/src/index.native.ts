import { isReactNative } from './utils/platform.js'

if (!isReactNative()) {
  console.warn(
    '@zerodev/wallet-react/react-native: the React Native entry was loaded outside a React Native runtime. If this is a non-RN context, import `@zerodev/wallet-react` (the bare specifier) instead.',
  )
}

// Shared API surface — identical to the bare specifier, EXCEPT:
//  - useAuthenticateOAuth comes from ./native/hooks/useAuthenticateOAuth.js
//    (type-narrowed to require getSessionId + redirectUri)
//  - useExportWallet / useExportPrivateKey are intentionally NOT re-exported;
//    the native export flow is component-driven via ZeroDevExportWebView at
//    @zerodev/wallet-react/react-native/export/webview.
export {
  getZeroDevConnector,
  getZeroDevStore,
  getZeroDevWallet,
} from './actions.js'
export type { GetOAuthSessionIdFn } from './authenticateOAuth.js'
export type {
  WalletMode,
  ZeroDevWalletConnectorParams,
} from './connector.js'
export { zeroDevWallet } from './connector.js'
export { useAuthenticators } from './hooks/useAuthenticators.js'
export { useLoginPasskey } from './hooks/useLoginPasskey.js'
export { useRefreshSession } from './hooks/useRefreshSession.js'
export { useRegisterPasskey } from './hooks/useRegisterPasskey.js'
export { useSendMagicLink } from './hooks/useSendMagicLink.js'
export { useSendOTP } from './hooks/useSendOTP.js'
export { useVerifyMagicLink } from './hooks/useVerifyMagicLink.js'
export { useVerifyOTP } from './hooks/useVerifyOTP.js'
// Native-specific auth hook
export { useAuthenticateOAuth } from './native/hooks/useAuthenticateOAuth.js'
export type { ZeroDevProvider } from './provider.js'
export type { ZeroDevWalletState } from './store.js'
export { createZeroDevWalletStore } from './store.js'
export type { OAuthProvider } from './utils/verifyGoogleLoginUrl.js'
export {
  generateOAuthNonce,
  OAUTH_PROVIDERS,
  verifyGoogleLoginUrl,
} from './utils/verifyGoogleLoginUrl.js'
