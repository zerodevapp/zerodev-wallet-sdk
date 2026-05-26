// Catch-all stub used by every `./react-native/*` subpath in this package
// under the `browser` exports condition. Imports must be safe on web (some
// route files are bundled even when they aren't rendered, e.g. expo-router
// enumerating every route file) so we expose the RN-only symbols as
// throw-on-use functions instead of throwing at module-init time.
//
// Anyone who *renders* these on web gets a clear actionable error; anyone
// who merely imports them (typically because their universal app bundles
// the native variant too) is unaffected.

const message =
  '@zerodev/wallet-react react-native subpaths cannot be imported in a web environment. Use the bare specifier (`import { ... } from "@zerodev/wallet-react"`) instead.'

function throwOnUse(): never {
  throw new Error(message)
}

export const ZeroDevExportWebView = throwOnUse
export const useAuthenticateOAuthWithExpoWebBrowser = throwOnUse

// For the broad `./react-native` entry: any consumer reaching it on web is
// already off-pattern (they should use the bare specifier). Default export
// covers `import X from '...'` and namespace imports access the named
// exports above.
export default throwOnUse
