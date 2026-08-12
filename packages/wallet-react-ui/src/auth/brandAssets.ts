import url from './assets/wallet-connect.svg?url'

// Typed explicitly so the emitted d.ts is self-contained — a bare re-export
// would leak the `.svg?url` specifier into consumers' typecheck.
export const walletConnectLogo: string = url
