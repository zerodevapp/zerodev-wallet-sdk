// Duplicated verbatim from @zerodev/wallet-core's utils/platform.ts.
// Intentional duplication avoids cross-package bare-specifier imports that
// could resolve to the wrong platform entry under non-standard package
// manager / bundler configs.
export function isReactNative(): boolean {
  if (
    typeof navigator !== 'undefined' &&
    (navigator as { product?: string }).product === 'ReactNative'
  ) {
    return true
  }
  if (
    typeof window !== 'undefined' &&
    Object.hasOwn(window, 'ReactNativeWebView')
  ) {
    return true
  }
  if (
    typeof globalThis !== 'undefined' &&
    Object.hasOwn(globalThis, 'HermesEngine')
  ) {
    return true
  }
  return false
}
