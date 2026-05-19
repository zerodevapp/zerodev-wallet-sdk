// Re-declare the app-side wrapper hook's signature so TS sees a no-arg hook
// regardless of platform (Metro picks `.native.ts` on RN, `.web.ts` on web).
// The library's RN-side type narrows the hook to require getSessionId +
// redirectUri at the type level; our wrapper supplies both internally so the
// app calls `useAuthenticateOAuth()` with no args.
import type { useAuthenticateOAuth as UseAuthOAuth } from '@zerodev/wallet-react'

type AuthReturn = ReturnType<typeof UseAuthOAuth>

export declare function useAuthenticateOAuth(): AuthReturn
