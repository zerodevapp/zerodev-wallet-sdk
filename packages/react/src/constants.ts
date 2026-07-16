// Origin of the ZeroDev AA bundler + paymaster (prod). Consumers override the
// host (not the version/path) via the connector's `aaHost` option.
export const ZERODEV_AA_HOST = 'https://rpc.zerodev.app'

// ZeroDev AA API version the SDK targets. Owned by the SDK (bumped alongside a
// release that supports a new version) — never set by consumers.
export const ZERODEV_AA_VERSION = 'v3'

// Bundler/paymaster provider the SDK requests by default (appended as
// `?provider=` to the AA URL). Owned by the SDK.
export const ZERODEV_AA_PROVIDER = 'ULTRA_RELAY'
