---
"@zerodev/wallet-react": patch
---

fix(react): preserve caller's pathname in OAuth `returnTo` so the popup lands on the same route as the parent. Previously the SDK used `window.location.origin` only, which redirected the popup to `/`. If `/` rendered a different app (or no SDK provider), the OAuth callback handler never ran and the popup hung.
