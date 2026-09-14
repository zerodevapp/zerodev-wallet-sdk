---
"@zerodev/wallet-react-ui": patch
---

fix: magic-link verification no longer dead-ends on `/verify?code=…`

- The persisted OTP session is now restored before base connector setup.
  Verification raced the restore: `auth.initialize()` (a synchronous
  localStorage read) only ran after `await connector.setup?.()`, whose async
  work (wallet creation, session validation) could be slow or fail.
  `Verifying` reads the session once on mount, so landing on the magic link
  before the restore finished stripped the code from the URL and silently
  dropped the flow. The restore now runs first, synchronously inside wagmi's
  `createConfig`, so the session is always in the store before any React
  effect can observe it.
- Opening a magic link with no pending OTP session (expired, already used,
  or a browser that never started the email flow) now shows a "Link
  Expired" error with a path back to sign-in, instead of stripping the code
  and rendering nothing.
